# @segmsh/mdx

MDX processor for [segm.sh](https://segm.sh). Built on top of `@segmsh/md`, this package extends Markdown processing with MDX support, parsing MDX into a document tree plus segments and stringifying it back while preserving structure.

## Installation

```bash
npm install @segmsh/mdx
```

## Usage

```typescript
import MdxProcessor from "@segmsh/mdx";

const processor = new MdxProcessor();

const mdxContent = '# Hello world';
// Parse into a Document (tree + segments)
const document = processor.parse(mdxContent);

// ... modify document segments ...

// Stringify back to MDX
const newMdxContent = processor.stringify(document);
```

## Features

- **MDX Support**: Handles JSX components, imports, and exports within Markdown.
- **Structure Preservation**: Maintains the original structure of the MDX document.
- **Round-trip**: Ensures that parsing and then stringifying results in the original MDX structure, preserving as much formatting as possible.

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## License

[Apache-2.0](LICENSE)
