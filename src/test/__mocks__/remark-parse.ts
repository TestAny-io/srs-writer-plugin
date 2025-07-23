/**
 * Mock for remark-parse package to avoid ES modules issues in Jest
 * Provides basic markdown parsing for headings and lists
 */

export function remarkParse() {
  return function (tree: any, file: any) {
    // We don't actually use these parameters in parse(), but the signature should match
    return null; // This shouldn't be called in the way we use it
  };
}

// The actual parsing function that gets called
remarkParse.parse = function(content: string) {
  const lines = content.split('\n');
  const children: any[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      children.push({
        type: 'heading',
        depth: headingMatch[1].length,
        children: [{ type: 'text', value: headingMatch[2] }],
        position: {
          start: { line: i + 1, column: 1 },
          end: { line: i + 1, column: line.length + 1 }
        }
      });
      continue;
    }
    
    // Parse list items
    const listMatch = line.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      // Create a list container if needed
      const lastChild = children[children.length - 1];
      if (!lastChild || lastChild.type !== 'list') {
        children.push({
          type: 'list',
          ordered: false,
          start: null,
          spread: false,
          children: [],
          position: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length + 1 }
          }
        });
      }
      
      const currentList = children[children.length - 1];
      currentList.children.push({
        type: 'listItem',
        spread: false,
        checked: null,
        children: [{
          type: 'paragraph',
          children: [{ type: 'text', value: listMatch[1] }]
        }],
        position: {
          start: { line: i + 1, column: 1 },
          end: { line: i + 1, column: line.length + 1 }
        }
      });
      continue;
    }
    
    // Parse regular paragraphs
    if (line) {
      children.push({
        type: 'paragraph',
        children: [{ type: 'text', value: line }],
        position: {
          start: { line: i + 1, column: 1 },
          end: { line: i + 1, column: line.length + 1 }
        }
      });
    }
  }
  
  return {
    type: 'root',
    children: children
  };
};

export default remarkParse; 