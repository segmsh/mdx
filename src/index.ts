import MdProcessor from "@segmsh/md";
import parse from "remark-parse";
import stringify from "remark-stringify";
import { Document, element, text, visitParents } from "@segmsh/core";
import { unified } from "unified";
import mdx from "remark-mdx";
import remarkFrontmatter from "remark-frontmatter";
import gfm from "remark-gfm";
import type { Root as MdastRoot } from "mdast";
import { getTagNameWithAttributes } from "./utils/get-tag-name-with-attributes.js";
import { getFlatChildren } from "./utils/get-flat-children.js";

type MdastNodes = import("mdast").Nodes;

const htmlSimpleTags: string[] = [
  "html",
  "aside",
  "blockquote",
  "body",
  "dl",
  "details",
  "div",
  "figure",
  "footer",
  "head",
  "header",
  "iframe",
  "noscript",
  "object",
  "ol",
  "q",
  "ruby",
  "samp",
  "script",
  "section",
  "style",
  "table",
  "template",
  "ul",
];
const avoidHtmlType = "html!";
const avoidHtmlTags: string[] = ["iframe", "html"];

let placeholderReplacements: Record<string, string> = {};
let placeholderCounter = 1;

const findReplacementRange = (
  lines: string[],
  errorIndex: number,
  isTagError: boolean,
) => {
  let endIndex = -1;
  let startIndex = -1;
  let tempEndIndex = -1;
  let tempStartIndex = -1;
  const codeLineRegex = /^ {4,}|^$/;

  for (let i = errorIndex; i < lines.length; i++) {
    const searchRule = isTagError ? lines[i] === "" : !codeLineRegex.test(lines[i]);
    if (searchRule) {
      tempEndIndex = i - 1;
      break;
    }
  }

  if (tempEndIndex <= 0) {
    tempEndIndex = lines.length - 1;
  }

  for (let i = errorIndex - 1; i >= 0; i--) {
    const searchRule = isTagError ? lines[i] === "" : !codeLineRegex.test(lines[i]);
    if (searchRule) {
      tempStartIndex = i + 1;
      break;
    }
  }

  for (let i = tempStartIndex; i < lines.length; i++) {
    if (lines[i]) {
      startIndex = i;
      break;
    }
  }

  for (let i = tempEndIndex; i >= 0; i--) {
    if (lines[i]) {
      endIndex = i;
      break;
    }
  }

  return { startIndex, endIndex };
};

const errorHandler = (error: any, doc: string) => {
  const errorIndex = error.line - 1;
  const lines = doc.split(/\r\n|\r|\n/);
  const placeholder = "incorrect_syntax_" + placeholderCounter;
  const trimmedLine = lines[errorIndex]?.trim();

  if (error.ruleId === "unexpected-eof") {
    const { startIndex, endIndex } = findReplacementRange(lines, errorIndex, false);
    lines.splice(startIndex, 0, "```");
    lines.splice(endIndex + 2, 0, "```");
  }

  if (error.ruleId === "acorn") {
    const { startIndex, endIndex } = findReplacementRange(lines, errorIndex, false);
    const deleteCount = endIndex - startIndex + 1;
    placeholderReplacements[placeholder] = lines
      .splice(startIndex, deleteCount <= 0 ? 1 : deleteCount, placeholder)
      .join("\n");
    placeholderCounter++;
  }

  if (
    error.ruleId === "unexpected-closing-slash" ||
    error.ruleId === "end-tag-mismatch"
  ) {
    const { startIndex, endIndex } = findReplacementRange(lines, errorIndex, true);
    const deleteCount = endIndex - startIndex + 1;
    placeholderReplacements[placeholder] = lines
      .splice(startIndex, deleteCount <= 0 ? 1 : deleteCount, placeholder)
      .join("\n");
    placeholderCounter++;
  }

  if (error.ruleId === "unexpected-character") {
    placeholderReplacements[placeholder] = lines[errorIndex];
    lines[errorIndex] = lines[errorIndex].replace(trimmedLine as string, placeholder);
    placeholderCounter++;
  }

  return lines.join("\n");
};

export default class MdxProcessor extends MdProcessor {
  protected parseMarkdownToMdast(doc: string): { mdast: MdastRoot; newDoc: string } {
    let mdast: MdastRoot;

    try {
      mdast = unified()
        .use(parse)
        .use(mdx)
        .use(remarkFrontmatter, ["yaml", "toml"])
        .use(gfm)
        .parse(doc);
    } catch (error: any) {
      const newDoc = errorHandler(error, doc);
      return this.parseMarkdownToMdast(newDoc);
    }

    const replacePlaceholders = (): void => {
      visitParents(
        mdast,
        (node: any) => node.type === "text",
        (node: any) => {
          Object.keys(placeholderReplacements).forEach((key) => {
            if (node.value.includes(key)) {
              const source = placeholderReplacements[key];
              const lengthDiff = source.length - key.length;

              node.value = node.value.replace(key, source);
              doc = doc.replace(key, source);

              visitParents(
                mdast,
                (child: any) => "position" in child,
                (child: any) => {
                  if (child.position.start.offset >= node.position.end.offset) {
                    child.position.start.offset += lengthDiff;
                    child.position.end.offset += lengthDiff;
                  }
                },
              );

              delete placeholderReplacements[key];
            }
          });
        },
      );
    };

    while (Object.keys(placeholderReplacements).length > 0) {
      replacePlaceholders();
    }

    return { mdast, newDoc: doc };
  }

  protected parseMdastToMarkdown(mdast: MdastRoot): string {
    return unified()
      .use(mdx)
      .use(gfm)
      .use(stringify, {
        handlers: this.getMdastToStringHandlers(),
      })
      .stringify(mdast) as string;
  }

  public parse(doc: string): Document {
    placeholderReplacements = {};
    placeholderCounter = 1;

    const mdxNodeHandler = (state: any, node: MdastNodes) => ({
      ...node,
      children: state.all(node),
    });

    const mdxParagraphHandler = (state: any, node: any) => {
      visitParents(node, { type: "mdxJsxTextElement" }, (child: any) => {
        const tag = getTagNameWithAttributes(child);

        if (htmlSimpleTags.includes(child.name)) {
          node.type = avoidHtmlTags.includes(child.name) ? avoidHtmlType : "raw";
          child.value = `${tag}${child.children[0]?.value ?? ""}</${child.name}>`;

          delete child.attributes;
          delete child.name;
          delete child.type;
        } else {
          child.children = [
            {
              type: "html",
              marker: "html",
              value: `${tag}`,
            },
            ...child.children,
            {
              type: "html",
              marker: "html",
              value: `</${child.name}>`,
            },
          ];

          delete child.attributes;
          delete child.name;
        }
      });

      if (node.type === avoidHtmlType || node.type === "raw") {
        node.value = node.children.map((child: any) => child.value).join("");
        delete node.children;
        return node;
      }

      node.children = getFlatChildren(node.children).flat(Infinity);
      return this.mdParagraphHandler(state, node, this.mdast);
    };

    const mdxFlowHandler = (_state: any, node: any) =>
      element(
        "p",
        {},
        text(
          this.parseMdastToMarkdown({
            type: "root",
            children: [node],
          } as MdastRoot).trim(),
        ),
      );

    this.addMdastToHastHandler(
      {},
      {
        mdxjsEsm: mdxFlowHandler,
        mdxJsxFlowElement: mdxFlowHandler,
        mdxFlowExpression: mdxFlowHandler,
        mdxTextExpression: mdxNodeHandler,
        paragraph: mdxParagraphHandler,
        heading: mdxParagraphHandler,
      },
    );
    this.addPassThroughTypes([
      "mdxJsxFlowElement",
      "mdxFlowExpression",
      "mdxTextExpression",
    ]);

    return super.parse(doc);
  }

  public stringify(data: Document): string {
    this.removeExtraLineBreaks(data.tree);

    const mdxNodeHandler = (state: any, node: any) => ({
      ...node,
      children: state.all(node),
    });

    this.addHastToMdastHandler(
      {},
      {
        mdxJsxFlowElement: mdxNodeHandler,
        mdxFlowExpression: mdxNodeHandler,
        mdxTextExpression: mdxNodeHandler,
      },
    );

    return super.stringify(data);
  }

  private removeExtraLineBreaks(tree: Document["tree"]) {
    visitParents(
      tree,
      (node: any, _index: number | undefined, parent: any) =>
        node.type === "text" && parent?.type === "root",
      (node: any) => {
        if (!node?.value?.trim()) {
          node.value = "";
        }
      },
    );
  }
}
