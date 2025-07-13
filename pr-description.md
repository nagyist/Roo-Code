## Description

Fixes #5655

This PR resolves three critical issues with codebase indexing file exclusion rules that were preventing .gitignore and .rooignore files from working correctly.

## Issues Fixed

### 1. .gitignore files have no effect on indexing

**Root Cause**: The manager was trying to read a single `.gitignore` file without checking existence, causing silent failures.

**Solution**: Replaced broken logic with proper use of `findGitignoreFiles()` function that walks up the directory tree to find all .gitignore files and loads patterns correctly.

### 2. .rooignore files only work after VSCode restart and are inconsistent

**Root Cause**: Each scan was creating new `RooIgnoreController` instances without file watchers, losing ignore patterns.

**Solution**: Created a global `RooIgnoreController` instance in the manager that is reused across all components, ensuring file watchers and patterns are preserved.

### 3. .rooignore rules are ignored after using 'Clear Index Data' until VSCode restart

**Root Cause**: Service recreation during "Clear Index Data" wasn't reloading ignore patterns.

**Solution**: Made `loadRooIgnore()` method public and ensured patterns are reloaded during service recreation.

## Changes Made

- **src/services/code-index/manager.ts**:

    - Added global `_rooIgnoreController` instance
    - Fixed .gitignore loading to use `findGitignoreFiles()` instead of broken single-file logic
    - Added proper initialization and disposal of RooIgnoreController
    - Ensured patterns are reloaded during service recreation

- **src/core/ignore/RooIgnoreController.ts**:

    - Made `loadRooIgnore()` method public for external reloading
    - Fixed `dispose()` method to handle undefined disposables safely

- **src/services/code-index/processors/scanner.ts**:

    - Updated constructor to accept optional `RooIgnoreController` parameter
    - Modified logic to use injected controller instead of creating new instances

- **src/services/code-index/service-factory.ts**:

    - Updated factory methods to accept and pass `RooIgnoreController`
    - Ensured global controller is used by both scanner and file watcher

- **src/services/glob/list-files.ts**:
    - Exported `findGitignoreFiles()` function for use in manager

## Testing

- **Added comprehensive integration tests** in `src/services/code-index/__tests__/ignore-integration.spec.ts` covering:

    - .gitignore pattern loading and application
    - RooIgnoreController instance preservation across service recreations
    - Pattern reloading during service recreation
    - Integration between gitignore and rooignore controllers

- **Fixed existing test infrastructure**:

    - Updated VSCode mocks to include `RelativePattern` and `createFileSystemWatcher`
    - Fixed test mocks to properly simulate initialized manager state

- **All tests passing**:
    - ✅ 5/5 new integration tests pass
    - ✅ 346/346 code-index tests pass (no regressions)
    - ✅ All linting and type checking passes

## Verification of Acceptance Criteria

- [x] **.gitignore files now have effect on indexing**: Fixed broken loading logic
- [x] **.rooignore files work consistently without VSCode restart**: Global controller instance preserves patterns and file watchers
- [x] **.rooignore rules persist after "Clear Index Data"**: Patterns are properly reloaded during service recreation
- [x] **All existing functionality preserved**: No breaking changes, backward compatible
- [x] **Comprehensive test coverage**: Integration tests verify all three issues are resolved

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] No breaking changes
- [x] All tests pass (346/346 code-index tests)
- [x] Linting and type checking pass
- [x] Integration tests added for all reported issues
- [x] Backward compatibility maintained
