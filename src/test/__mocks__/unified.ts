/**
 * Mock for unified package to avoid ES modules issues in Jest
 */

export interface Processor {
  use: (plugin: any, options?: any) => Processor;
  process: (content: string) => Promise<{ value: string; data: any }>;
  parse: (content: string) => any;
}

export function unified(): Processor {
  const plugins: Array<{ plugin: any; options?: any }> = [];
  
  return {
    use(plugin: any, options?: any) {
      plugins.push({ plugin, options });
      return this;
    },
    
    async process(content: string) {
      // Simple mock implementation
      return {
        value: content,
        data: {}
      };
    },
    
    parse(content: string) {
      // Check if remark-parse plugin was used
      const remarkParsePlugin = plugins.find(p => p.plugin.name === 'remarkParse' || p.plugin.default?.name === 'remarkParse');
      
      if (remarkParsePlugin) {
        // Use the remark-parse mock
        const remarkParse = require('./remark-parse');
        if (remarkParse.default && typeof remarkParse.default.parse === 'function') {
          return remarkParse.default.parse(content);
        } else if (typeof remarkParse.remarkParse?.parse === 'function') {
          return remarkParse.remarkParse.parse(content);
        }
      }
      
      // Fallback: Simple mock AST with basic parsing
      const lines = content.split('\n');
      const children: any[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip empty lines
        if (!line.trim()) {
          continue;
        }
        
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
        
        // Parse list items - 支持所有列表标记类型
        const listMatch = line.match(/^(\s*)([-*+]|\d+[.\)])\s+(.+)$/);
        if (listMatch) {
          const indent = listMatch[1].length;
          const marker = listMatch[2];
          const content = listMatch[3];
          const isOrdered = /^\d+[.\)]$/.test(marker);
          
          // Create a list container if needed or if different type
          const lastChild = children[children.length - 1];
          if (!lastChild || lastChild.type !== 'list' || lastChild.ordered !== isOrdered) {
            children.push({
              type: 'list',
              ordered: isOrdered,
              start: isOrdered ? parseInt(marker.match(/\d+/)?.[0] || '1') : null,
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
              children: [{ type: 'text', value: content }]
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
    }
  };
}

export default { unified }; 