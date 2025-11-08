import {
    ProjectNameValidator,
    ProjectNameValidationError,
    ProjectNameErrorCode
} from '../../utils/project-name-validator';

describe('ProjectNameValidator', () => {
    describe('validateProjectName', () => {
        describe('✅ Valid project names', () => {
            test('should accept simple alphanumeric names', () => {
                expect(ProjectNameValidator.validateProjectName('my-project')).toBe('my-project');
                expect(ProjectNameValidator.validateProjectName('MyProject')).toBe('MyProject');
                expect(ProjectNameValidator.validateProjectName('project123')).toBe('project123');
            });

            test('should accept names with spaces', () => {
                expect(ProjectNameValidator.validateProjectName('My Project')).toBe('My Project');
                expect(ProjectNameValidator.validateProjectName('Project Name 2')).toBe('Project Name 2');
            });

            test('should accept names with underscores and hyphens', () => {
                expect(ProjectNameValidator.validateProjectName('my_project')).toBe('my_project');
                expect(ProjectNameValidator.validateProjectName('my-project')).toBe('my-project');
                expect(ProjectNameValidator.validateProjectName('my_project-name')).toBe('my_project-name');
            });

            test('should accept names with dots (but not ending)', () => {
                expect(ProjectNameValidator.validateProjectName('my.project')).toBe('my.project');
                expect(ProjectNameValidator.validateProjectName('v1.0.0')).toBe('v1.0.0');
            });

            test('should accept Chinese/Unicode names', () => {
                expect(ProjectNameValidator.validateProjectName('我的项目')).toBe('我的项目');
                expect(ProjectNameValidator.validateProjectName('プロジェクト')).toBe('プロジェクト');
                expect(ProjectNameValidator.validateProjectName('项目-v1')).toBe('项目-v1');
            });

            test('should accept names with parentheses and brackets', () => {
                expect(ProjectNameValidator.validateProjectName('project(v2)')).toBe('project(v2)');
                expect(ProjectNameValidator.validateProjectName('project[beta]')).toBe('project[beta]');
            });
        });

        describe('❌ Invalid project names - Empty/Length', () => {
            test('should reject empty names', () => {
                expect(() => ProjectNameValidator.validateProjectName('')).toThrow(ProjectNameValidationError);
                expect(() => ProjectNameValidator.validateProjectName('   ')).toThrow(ProjectNameValidationError);
                expect(() => ProjectNameValidator.validateProjectName(null)).toThrow(ProjectNameValidationError);
                expect(() => ProjectNameValidator.validateProjectName(undefined)).toThrow(ProjectNameValidationError);
            });

            test('should reject names that are too long', () => {
                const longName = 'a'.repeat(256);
                try {
                    ProjectNameValidator.validateProjectName(longName);
                    fail('Should have thrown ProjectNameValidationError');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.TOO_LONG);
                }
            });

            test('should accept maximum length names (255 chars)', () => {
                const maxLengthName = 'a'.repeat(255);
                expect(ProjectNameValidator.validateProjectName(maxLengthName)).toBe(maxLengthName);
            });
        });

        describe('❌ Invalid project names - Path Separators', () => {
            test('should reject names with forward slash', () => {
                try {
                    ProjectNameValidator.validateProjectName('my/project');
                    fail('Should have thrown ProjectNameValidationError');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.PATH_SEPARATOR);
                }
            });

            test('should reject names with backslash', () => {
                try {
                    ProjectNameValidator.validateProjectName('my\\project');
                    fail('Should have thrown ProjectNameValidationError');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.PATH_SEPARATOR);
                }
            });

            test('should reject names attempting to create nested directories', () => {
                expect(() => ProjectNameValidator.validateProjectName('parent/child/project')).toThrow(
                    ProjectNameValidationError
                );
                expect(() => ProjectNameValidator.validateProjectName('..\\..\\evil')).toThrow(
                    ProjectNameValidationError
                );
            });
        });

        describe('❌ Invalid project names - Path Escaping', () => {
            test('should reject dot and double-dot', () => {
                try {
                    ProjectNameValidator.validateProjectName('.');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.PATH_ESCAPE);
                }

                try {
                    ProjectNameValidator.validateProjectName('..');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.PATH_ESCAPE);
                }
            });

            test('should reject names containing double-dot', () => {
                try {
                    ProjectNameValidator.validateProjectName('my..project');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.PATH_ESCAPE);
                }

                try {
                    ProjectNameValidator.validateProjectName('project..name');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.PATH_ESCAPE);
                }
            });
        });

        describe('❌ Invalid project names - Illegal Characters', () => {
            const illegalChars = ['<', '>', ':', '"', '|', '?', '*'];

            illegalChars.forEach(char => {
                test(`should reject names with "${char}"`, () => {
                    try {
                        ProjectNameValidator.validateProjectName(`my${char}project`);
                        fail(`Should have thrown for character: ${char}`);
                    } catch (error) {
                        expect(error).toBeInstanceOf(ProjectNameValidationError);
                        expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.INVALID_CHARS);
                    }
                });
            });

            test('should reject names with control characters', () => {
                try {
                    ProjectNameValidator.validateProjectName('my\x00project');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.INVALID_CHARS);
                }

                try {
                    ProjectNameValidator.validateProjectName('project\nname');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.INVALID_CHARS);
                }
            });
        });

        describe('❌ Invalid project names - Windows Reserved Names', () => {
            const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9'];

            reservedNames.forEach(name => {
                test(`should reject Windows reserved name "${name}"`, () => {
                    try {
                        ProjectNameValidator.validateProjectName(name);
                        fail(`Should have thrown for reserved name: ${name}`);
                    } catch (error) {
                        expect(error).toBeInstanceOf(ProjectNameValidationError);
                        expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.RESERVED_NAME);
                    }
                });

                test(`should reject Windows reserved name "${name}" (case-insensitive)`, () => {
                    try {
                        ProjectNameValidator.validateProjectName(name.toLowerCase());
                        fail(`Should have thrown for reserved name: ${name.toLowerCase()}`);
                    } catch (error) {
                        expect(error).toBeInstanceOf(ProjectNameValidationError);
                        expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.RESERVED_NAME);
                    }
                });

                test(`should reject Windows reserved name with extension "${name}.txt"`, () => {
                    try {
                        ProjectNameValidator.validateProjectName(`${name}.txt`);
                        fail(`Should have thrown for reserved name with extension: ${name}.txt`);
                    } catch (error) {
                        expect(error).toBeInstanceOf(ProjectNameValidationError);
                        expect((error as ProjectNameValidationError).code).toBe(ProjectNameErrorCode.RESERVED_NAME);
                    }
                });
            });
        });

        describe('❌ Invalid project names - Space/Dot Boundaries', () => {
            test('should reject names with leading spaces', () => {
                try {
                    ProjectNameValidator.validateProjectName('  project');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(
                        ProjectNameErrorCode.STARTS_OR_ENDS_WITH_SPACE
                    );
                }
            });

            test('should reject names with trailing spaces', () => {
                try {
                    ProjectNameValidator.validateProjectName('project  ');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(
                        ProjectNameErrorCode.STARTS_OR_ENDS_WITH_SPACE
                    );
                }
            });

            test('should reject names ending with dot', () => {
                try {
                    ProjectNameValidator.validateProjectName('project.');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                    expect((error as ProjectNameValidationError).code).toBe(
                        ProjectNameErrorCode.STARTS_OR_ENDS_WITH_SPACE
                    );
                }

                try {
                    ProjectNameValidator.validateProjectName('my-project...');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ProjectNameValidationError);
                }
            });
        });
    });

    describe('isValidProjectName', () => {
        test('should return valid:true for valid names', () => {
            const result = ProjectNameValidator.isValidProjectName('my-project');
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        test('should return valid:false with error message for invalid names', () => {
            const result = ProjectNameValidator.isValidProjectName('my/project');
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.code).toBe(ProjectNameErrorCode.PATH_SEPARATOR);
        });

        test('should return valid:false for empty names', () => {
            const result = ProjectNameValidator.isValidProjectName('');
            expect(result.valid).toBe(false);
            expect(result.code).toBe(ProjectNameErrorCode.EMPTY);
        });
    });

    describe('sanitizeProjectName', () => {
        test('should remove illegal characters', () => {
            expect(ProjectNameValidator.sanitizeProjectName('my<project>')).toBe('my_project_');
            expect(ProjectNameValidator.sanitizeProjectName('my:project')).toBe('my_project');
            expect(ProjectNameValidator.sanitizeProjectName('my|project')).toBe('my_project');
        });

        test('should replace path separators with hyphens', () => {
            expect(ProjectNameValidator.sanitizeProjectName('my/project')).toBe('my-project');
            expect(ProjectNameValidator.sanitizeProjectName('my\\project')).toBe('my-project');
        });

        test('should remove double-dots', () => {
            expect(ProjectNameValidator.sanitizeProjectName('my..project')).toBe('my.project');
            expect(ProjectNameValidator.sanitizeProjectName('..')).toBe('');
        });

        test('should remove leading/trailing spaces and dots', () => {
            expect(ProjectNameValidator.sanitizeProjectName('  project  ')).toBe('project');
            expect(ProjectNameValidator.sanitizeProjectName('.project.')).toBe('project');
        });

        test('should truncate long names', () => {
            const longName = 'a'.repeat(300);
            const sanitized = ProjectNameValidator.sanitizeProjectName(longName);
            expect(sanitized.length).toBe(255);
        });

        test('should prefix Windows reserved names', () => {
            expect(ProjectNameValidator.sanitizeProjectName('CON')).toBe('_CON');
            expect(ProjectNameValidator.sanitizeProjectName('aux')).toBe('_aux');
            expect(ProjectNameValidator.sanitizeProjectName('NUL.txt')).toBe('_NUL.txt');
        });

        test('should handle empty input', () => {
            expect(ProjectNameValidator.sanitizeProjectName('')).toBe('');
            expect(ProjectNameValidator.sanitizeProjectName('   ')).toBe('');
        });
    });
});
