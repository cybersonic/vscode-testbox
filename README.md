# TestBox Support for Visual Studio Code

This extension provides support for the TestBox BDD/TDD framework in Visual Studio Code by [Ortus Solutions](https://www.ortussolutions.com).

## Target Platforms

- TestBox 6.x+
- TestBox 5.x+
- TestBox 4.x+

## Features

### Test Explorer

<img src="images/run-from-explorer.gif" alt="Run from Explorer">

Tests are discovered automatically and a test explorer view is available from the Activity Bar.  You can run tests from the explorer view by clicking on the play icon as well as being able to run the tests right from the editor.

### Jump to Spec

<img src="images/jump-to-spec.png" alt="jump to spec">

A "**Jump to specific TestBox spec**" is available in the command pallete.  This lets you
quickly search for and jump to a specific spec in the currently open file.

You can add a custom keyboard shortcut for this yourself in your Keyboard Shortcuts menu or use the default of `shift+cmd+t`

### TestBox Run Commands

We have also added a few commands to the command pallete to help you with your testing:

<img src="images/testbox-commands.png" alt="jump to spec">

You can :

- Run the entire test harness
- Run the bundle you have currently open
- Run the spec you have your cursor on
- Run the previous tests

### TestBox Configuration

We have now added a configuration panel so you can configure the runners and commands.  You can access it via the command pallete or the settings panel.

<img src="images/testbox-config.png" alt="jump to spec">

### Code Skeleton Snippets

- `bdd ➝` : Creates a TestBox BDD Bundle
- `unit ➝` : Creates a TestBox TDD xUnit Bundle

### TestBox Snippets

- `assert` : An `assert()` method
- `afterAll ➝` : An `afterAll()` BDD life-cycle method
- `aftereach ➝` : An `afterEach()` BDD closure
- `afterTests ➝` : An `afterTests()` xUnit life-cycle method
- `aroundEach ➝` : An `aroundEach()` BDD closure
- `bdd ➝` : Creates a new BDD Test Bundle CFC
- `beforeAll ➝` : An `beforeAll()` BDD life-cycle method
- `beforeeach ➝` : A `beforeEach()` BDD closure
- `beforeTests ➝` : An `beforeTests()` xUnit life-cycle method
- `console ➝` : TestBox send some output to the console
- `debug ➝` : Writes up a non-duplicate `debug()` call
- `debugduplicate ➝` : Writes up a `debug()` call with duplicate
- `describe ➝` : A `describe` suite
- `describeFull ➝` : A `describe` suite with all arguments
- `expect ➝` : Starts an expectation DSL with a `toBe()` addition
- `expectAll ➝` : Starts a collection expectation DSL with a `toBe()` addition
- `expectFalse ➝` : Does a false expectation expression
- `expectTrue ➝` : Does a true expectation expression
- `expectToThrow ➝` : Starts an expectation that throws an exception
- `feature, featureFull ➝` : Starts a `feature()` block
- `given, givenFull ➝` : Starts a `given()` block
- `it ➝` : A test spec
- `itFull ➝` : A test spec with all arguments
- `setup ➝` : An `setup()` xUnit life-cycle method
- `story, storyFull ➝` : Starts a `story()` block
- `teardown ➝` : An `teardown()` xUnit life-cycle method
- `then, thenFull ➝` : Starts a `then()` block
- `unit ➝` : Creates a new xUnit Test Bundle CFC
- `when, whenFull ➝` : Starts a `when()` block

### ColdBox Testing Snippets

- `handlerTest ➝` : Creates a ColdBox Event Handler test case
- `integrationTest ➝` : Creates a top down integration BDD test case
- `interceptorTest ➝` : Creates an Interceptor test case
- `modelTest ➝` : Creates a model test case
- `testaction ➝` : Creates an integration spec case for an event action

## Installation instructions

Install the latest *vscode-testbox* package from https://marketplace.visualstudio.com/.

## Support

You can get official support in the following channels:

- https://github.com/Ortus-Solutions/vscode-testbox/issues
- https://community.ortussolutions.com/c/communities/testbox/11
- https://www.ortussolutions.com/services/support
