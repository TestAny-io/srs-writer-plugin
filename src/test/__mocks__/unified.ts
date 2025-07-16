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
      // Simple mock AST
      return {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                value: content
              }
            ]
          }
        ]
      };
    }
  };
}

export default { unified }; 