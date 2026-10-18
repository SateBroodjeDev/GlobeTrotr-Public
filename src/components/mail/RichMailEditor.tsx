import { useEffect, useRef } from "react";
import { Bold, Italic, Link, List, ListOrdered, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plainTextToMailHtml } from "@/lib/safe-mail-html";

type Props = {
  html: string;
  label: string;
  linkPrompt: string;
  onChange: (html: string, text: string) => void;
};

export function RichMailEditor({ html, label, linkPrompt, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html) editor.innerHTML = html;
  }, [html]);
  const publish = () => {
    const editor = editorRef.current;
    if (editor) onChange(editor.innerHTML, editor.innerText);
  };
  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    publish();
  };
  const insertPlainText = (text: string) => {
    const normalized = text.replace(/\r\n?/g, "\n");
    if (!normalized.includes("\n")) {
      document.execCommand(
        "insertText",
        false,
        normalized,
      );
      return;
    }
    document.execCommand("insertHTML", false, plainTextToMailHtml(normalized));
  };
  const addLink = () => {
    const href = window.prompt(linkPrompt, "https://");
    if (href && /^(https?:|mailto:)/i.test(href.trim())) command("createLink", href.trim());
  };
  const tools = [
    { label: "Bold", icon: Bold, action: () => command("bold") },
    { label: "Italic", icon: Italic, action: () => command("italic") },
    { label: "Underline", icon: Underline, action: () => command("underline") },
    { label: "Bullet list", icon: List, action: () => command("insertUnorderedList") },
    { label: "Numbered list", icon: ListOrdered, action: () => command("insertOrderedList") },
    { label: "Link", icon: Link, action: addLink },
  ];
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div
        className="flex flex-wrap gap-1 border-b bg-muted/40 p-2"
        role="toolbar"
        aria-label={label}
      >
        {tools.map(({ label: toolLabel, icon: Icon, action }) => (
          <Button
            key={toolLabel}
            type="button"
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label={toolLabel}
            title={toolLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={action}
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </div>
      <div
        ref={editorRef}
        className="min-h-48 px-4 py-3 text-sm leading-6 text-foreground outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
        contentEditable
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={publish}
        onPaste={(event) => {
          event.preventDefault();
          insertPlainText(event.clipboardData.getData("text/plain"));
          publish();
        }}
      />
    </div>
  );
}
