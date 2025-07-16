/**
 * Mock for remark-parse package to avoid ES modules issues in Jest
 */

export function remarkParse() {
  return function (tree: any, file: any) {
    // Simple mock implementation that returns a basic AST
    return {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Mock parsed content'
            }
          ]
        }
      ]
    };
  };
}

export default remarkParse; 