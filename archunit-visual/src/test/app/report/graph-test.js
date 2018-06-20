'use strict';

import chai from 'chai';
import './chai/node-chai-extensions';
import './chai/dependencies-chai-extension';

import stubs from './stubs';
import testJson from './test-json-creator';
import AppContext from '../../../main/app/report/app-context';
import createGraph from '../../../main/app/report/graph';

const expect = chai.expect;

const appContext = AppContext.newInstance({
  visualizationStyles: stubs.visualizationStylesStub(30),
  calculateTextWidth: stubs.calculateTextWidthStub,
  NodeView: stubs.NodeViewStub,
  DependencyView: stubs.DependencyViewStub,
  GraphView: stubs.GraphViewStub
});

const createResources = (root, violations) => ({
  getResources: () => ({root, violations})
});

describe('Graph', () => {
  const jsonRootWithTwoClasses = testJson.package('com.tngtech.archunit')
    .add(testJson.package('pkg1')
      .add(testJson.clazz('SomeClass', 'class')
        .callingMethod('com.tngtech.archunit.pkg2.SomeClass', 'startMethod()', 'targetMethod()')
        .build())
      .build())
    .add(testJson.package('pkg2')
      .add(testJson.clazz('SomeClass', 'class').build())
      .build())
    .build();

  it('creates a correct tree-structure with dependencies and a correct layout', () => {
    const graph = createGraph(appContext, createResources(jsonRootWithTwoClasses));

    const expNodes = ['com.tngtech.archunit', 'com.tngtech.archunit.pkg1',
      'com.tngtech.archunit.pkg1.SomeClass', 'com.tngtech.archunit.pkg2',
      'com.tngtech.archunit.pkg2.SomeClass'];
    const expDeps = ['com.tngtech.archunit.pkg1.SomeClass->com.tngtech.archunit.pkg2.SomeClass(methodCall)'];

    const actNodes = graph.root.getSelfAndDescendants();
    const actDeps = graph.dependencies.getVisible();
    expect(actNodes).to.containExactlyNodes(expNodes);
    expect(actDeps).to.haveDependencyStrings(expDeps);
    return graph.root._updatePromise;
  });

  it('can initially fold all nodes', () => {
    const graph = createGraph(appContext, createResources(jsonRootWithTwoClasses), null, true);
    const expNodes = ['com.tngtech.archunit', 'com.tngtech.archunit.pkg1', 'com.tngtech.archunit.pkg2'];
    const expDeps = ['com.tngtech.archunit.pkg1->com.tngtech.archunit.pkg2()'];

    expect(graph.root.getSelfAndDescendants()).to.containExactlyNodes(expNodes);
    expect(graph.dependencies.getVisible()).to.haveDependencyStrings(expDeps);
    return graph.root._updatePromise;
  });

  it('can filter node by name containing', () => {
    const jsonRoot = testJson.package('com.tngtech.archunit')
      .add(testJson.clazz('SomeClass1', 'class')
        .callingMethod('com.tngtech.archunit.SomeClass2', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('SomeClass2', 'class')
        .callingMethod('com.tngtech.archunit.NotMatchingClass', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('NotMatchingClass', 'class')
        .build())
      .build();

    const graph = createGraph(appContext, createResources(jsonRoot));
    const expNodes = ['com.tngtech.archunit', 'com.tngtech.archunit.SomeClass1', 'com.tngtech.archunit.SomeClass2'];
    const expDeps = ['com.tngtech.archunit.SomeClass1->com.tngtech.archunit.SomeClass2(methodCall)'];

    graph.filterNodesByName('Some', false);

    return graph.root._updatePromise.then(() => {
      expect(graph.root.getSelfAndDescendants()).to.containExactlyNodes(expNodes);
      expect(graph.dependencies.getVisible()).to.haveDependencyStrings(expDeps);
    });
  });

  it('can filter node by name not containing', () => {
    const jsonRoot = testJson.package('com.tngtech.archunit')
      .add(testJson.clazz('SomeClass1', 'class')
        .callingMethod('com.tngtech.archunit.SomeClass2', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('SomeClass2', 'class')
        .callingMethod('com.tngtech.archunit.MatchingClass', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('MatchingClass', 'class')
        .build())
      .build();

    const graph = createGraph(appContext, createResources(jsonRoot));
    const expNodes = ['com.tngtech.archunit', 'com.tngtech.archunit.SomeClass1', 'com.tngtech.archunit.SomeClass2'];
    const expDeps = ['com.tngtech.archunit.SomeClass1->com.tngtech.archunit.SomeClass2(methodCall)'];

    graph.filterNodesByName('Matching', true);

    return graph.root._updatePromise.then(() => {
      expect(graph.root.getSelfAndDescendants()).to.containExactlyNodes(expNodes);
      expect(graph.dependencies.getVisible()).to.haveDependencyStrings(expDeps);
    });
  });

  it('can filter nodes by type', () => {
    const jsonRoot = testJson.package('com.tngtech.archunit')
      .add(testJson.clazz('SomeClass1', 'class')
        .callingMethod('com.tngtech.archunit.SomeClass2', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('SomeClass2', 'class')
        .callingMethod('com.tngtech.archunit.SomeInterface', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('SomeInterface', 'interface')
        .build())
      .build();

    const graph = createGraph(appContext, createResources(jsonRoot));
    const expNodes = ['com.tngtech.archunit', 'com.tngtech.archunit.SomeClass1', 'com.tngtech.archunit.SomeClass2'];
    const expDeps = ['com.tngtech.archunit.SomeClass1->com.tngtech.archunit.SomeClass2(methodCall)'];

    graph.filterNodesByType({showInterfaces: false, showClasses: true});

    return graph.root._updatePromise.then(() => {
      expect(graph.root.getSelfAndDescendants()).to.containExactlyNodes(expNodes);
      expect(graph.dependencies.getVisible()).to.haveDependencyStrings(expDeps);
    });
  });

  it('can filter dependencies by type', () => {
    const jsonRoot = testJson.package('com.tngtech.archunit')
      .add(testJson.clazz('SomeClass1', 'class')
        .callingMethod('com.tngtech.archunit.SomeClass2', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('SomeClass2', 'class')
        .extending('com.tngtech.archunit.SomeClass1')
        .build())
      .build();

    const graph = createGraph(appContext, createResources(jsonRoot));
    const expDeps = ['com.tngtech.archunit.SomeClass1->com.tngtech.archunit.SomeClass2(methodCall)'];

    graph.filterDependenciesByType({
      showImplementing: false,
      showExtending: false,
      showConstructorCall: false,
      showMethodCall: true,
      showFieldAccess: false,
      showAnonymousImplementation: false,
      showDepsBetweenChildAndParent: true
    });

    expect(graph.dependencies.getVisible()).to.haveDependencyStrings(expDeps);
  });

  it('transforms the dependencies if a node is folded', () => {
    const jsonRoot = testJson.package('com.tngtech.archunit')
      .add(testJson.package('pkgToFold')
        .add(testJson.clazz('SomeClass1', 'class')
          .callingMethod('com.tngtech.archunit.SomeClass2', 'startMethod()', 'targetMethod()')
          .build())
        .build())
      .add(testJson.clazz('SomeClass2', 'class').build())
      .build();

    const graph = createGraph(appContext, createResources(jsonRoot));
    const exp = ['com.tngtech.archunit.pkgToFold->com.tngtech.archunit.SomeClass2()'];

    graph.root.getByName('com.tngtech.archunit.pkgToFold')._changeFoldIfInnerNodeAndRelayout();

    expect(graph.dependencies.getVisible()).to.haveDependencyStrings(exp);

    return graph.root._updatePromise;
  });

  it('updates the positions of the dependencies if a node is dragged', () => {
    const jsonRoot = testJson.package('com.tngtech.archunit')
      .add(testJson.clazz('SomeClass1', 'class')
        .callingMethod('com.tngtech.archunit.SomeClass2', 'startMethod()', 'targetMethod()')
        .build())
      .add(testJson.clazz('SomeClass2', 'class').build())
      .build();

    const graph = createGraph(appContext, createResources(jsonRoot));
    graph.root.getByName('com.tngtech.archunit.SomeClass1')._drag(10, 10);
    return graph.root._updatePromise.then(() => expect(graph.dependencies.getVisible()[0]._view.hasJumpedToPosition).to.equal(true));
  });
});