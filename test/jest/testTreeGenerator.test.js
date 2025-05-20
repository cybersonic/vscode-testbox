const { describe, it, expect } = require('@jest/globals');
const { generateTreeFromFile, generateTreeFromText, TreeBundle } = require('../../src/utils/testTreeGenerator');
const path = require('path');
const fs = require('fs');

describe('generateTreeFromFile', () => {

    const relativePath = "test/app/tests/specs/unit/CalculatorTest.cfc";

    const absolutePath = path.resolve(relativePath);
    const packageName = "tests.specs.unit";
    const runnerURL = "http://localhost:8080/runnner.cfm";

    it('should return a tree from a test', async () => {

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const treeRoot = await generateTreeFromText(content, absolutePath, packageName, runnerURL);
        console.log({ treeRoot });

        expect(treeRoot).toBeInstanceOf(TreeBundle);
        expect(treeRoot.packageName).toBe(packageName);
        expect(treeRoot.path).toBe(absolutePath);
        expect(treeRoot.children).toBeInstanceOf(Array);
        expect(treeRoot.children.length).toBeGreaterThan(0);
        expect(treeRoot.runnerUrl).toBe("http://localhost:8080/runnner.cfm");

        const firstChild = treeRoot.children[0];
        const secondChild = treeRoot.children[1];
        // console.log({ firstChild });
        expect(firstChild).toHaveProperty('name');
        expect(firstChild).toHaveProperty('children');
        expect(firstChild.name).toBe('describe');
        expect(firstChild.title).toBe('My First Suite');
        expect(secondChild.title).toBe('My Second Suite');

        // // Now check the children of the first test
        const firstGrandChild = firstChild.children[0];
        const secondGrandChild = firstChild.children[1];
        console.log(firstGrandChild)
        // expect(firstGrandChild).toHaveProperty('name');


    });
    // it('should return an empty tree when the file is empty', () => {
    //     const file = { content: '', path: '/path/to/emptyFile.js' };
    //     const result = generateTreeFromFile(file);
    //     expect(result).toEqual([]);
    // });

    // it('should generate a tree structure for a valid file', () => {
    //     const file = {
    //         content: `
    //             describe('Suite 1', () => {
    //                 it('should do something', () => {});
    //             });
    //         `,
    //         path: '/path/to/testFile.js'
    //     };
    //     const result = generateTreeFromFile(file);

    //     expect(result).toEqual([
    //         {
    //             name: 'Suite 1',
    //             children: [
    //                 {
    //                     name: 'should do something',
    //                     children: []
    //                 }
    //             ]
    //         }
    //     ]);
    // });

    // it('should handle nested test suites correctly', () => {
    //     const file = {
    //         content: `
    //             describe('Suite 1', () => {
    //                 describe('Nested Suite', () => {
    //                     it('should do something', () => {});
    //                 });
    //             });
    //         `,
    //         path: '/path/to/testFile.js'
    //     };
    //     const result = generateTreeFromFile(file);

    //     expect(result).toEqual([
    //         {
    //             name: 'Suite 1',
    //             children: [
    //                 {
    //                     name: 'Nested Suite',
    //                     children: [
    //                         {
    //                             name: 'should do something',
    //                             children: []
    //                         }
    //                     ]
    //                 }
    //             ]
    //         }
    //     ]);
    // });

    // it('should return an empty array if no test blocks are found', () => {
    //     const file = {
    //         content: `
    //             const someCode = () => {
    //                 console.log('This is not a test');
    //             };
    //         `,
    //         path: '/path/to/nonTestFile.js'
    //     };
    //     const result = generateTreeFromFile(file);
    //     expect(result).toEqual([]);
    // });

    // it('should throw an error if the file content is invalid', () => {
    //     const file = { content: null, path: '/path/to/invalidFile.js' };
    //     expect(() => generateTreeFromFile(file)).toThrow('Invalid file content');
    // });
});