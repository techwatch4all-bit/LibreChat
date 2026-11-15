import { useCallback } from 'react';
import download from 'downloadjs';
import { useParams } from 'react-router-dom';
import exportFromJSON from 'export-from-json';
import { useToastContext } from '@librechat/client';
import { useQueryClient } from '@tanstack/react-query';
import { buildTree, QueryKeys } from 'librechat-data-provider';
import type { TConversation, TMessage, TPreset } from 'librechat-data-provider';
import { ScreenshotLimitError, useScreenshot } from '~/hooks/ScreenshotContext';
import useBuildMessageTree from '~/hooks/Messages/useBuildMessageTree';
import { NotificationSeverity } from '~/common';
import { formatMessageText } from './format';
import { cleanupPreset } from '~/utils';
import { useLocalize } from '~/hooks';

type ExportValues = {
  fieldName: string;
  fieldValues: string[];
};
type ExportEntries = ExportValues[];

export default function useExportConversation({
  conversation,
  filename,
  type,
  includeOptions,
  exportBranches,
  recursive,
}: {
  conversation: TConversation | null;
  filename: string;
  type: string;
  includeOptions: boolean | 'indeterminate';
  exportBranches: boolean | 'indeterminate';
  recursive: boolean | 'indeterminate';
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const { captureScreenshot } = useScreenshot();
  const buildMessageTree = useBuildMessageTree();
  const localize = useLocalize();

  const { conversationId: paramId } = useParams();

  const getMessageTree = useCallback(() => {
    const queryParam =
      paramId === 'new' ? paramId : (conversation?.conversationId ?? paramId ?? '');
    const messages = queryClient.getQueryData<TMessage[]>([QueryKeys.messages, queryParam]) ?? [];
    const dataTree = buildTree({ messages });
    return dataTree?.length === 0 ? null : (dataTree ?? null);
  }, [paramId, conversation?.conversationId, queryClient]);

  const exportScreenshot = async () => {
    let data: Blob;
    try {
      data = await captureScreenshot();
    } catch (err) {
      console.error('Failed to capture screenshot', err);
      showToast({
        message: localize(
          err instanceof ScreenshotLimitError
            ? 'com_nav_export_screenshot_too_large'
            : 'com_nav_export_screenshot_error',
        ),
        severity: NotificationSeverity.ERROR,
        showIcon: true,
      });
      return;
    }
    download(data, `${filename}.png`, 'image/png');
  };

  const exportCSV = async () => {
    const data: Partial<TMessage>[] = [];

    const messages = await buildMessageTree({
      messageId: conversation?.conversationId,
      message: null,
      messages: getMessageTree(),
      branches: Boolean(exportBranches),
      recursive: false,
    });

    if (Array.isArray(messages)) {
      for (const message of messages) {
        if (!message) {
          continue;
        }
        data.push(message);
      }
    } else {
      data.push(messages);
    }

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'csv',
      exportType: exportFromJSON.types.csv,
      beforeTableEncode: (entries: ExportEntries | undefined) => [
        {
          fieldName: 'sender',
          fieldValues: entries?.find((e) => e.fieldName == 'sender')?.fieldValues ?? [],
        },
        {
          fieldName: 'text',
          fieldValues: entries?.find((e) => e.fieldName == 'text')?.fieldValues ?? [],
        },
        {
          fieldName: 'isCreatedByUser',
          fieldValues: entries?.find((e) => e.fieldName == 'isCreatedByUser')?.fieldValues ?? [],
        },
        {
          fieldName: 'error',
          fieldValues: entries?.find((e) => e.fieldName == 'error')?.fieldValues ?? [],
        },
        {
          fieldName: 'unfinished',
          fieldValues: entries?.find((e) => e.fieldName == 'unfinished')?.fieldValues ?? [],
        },
        {
          fieldName: 'messageId',
          fieldValues: entries?.find((e) => e.fieldName == 'messageId')?.fieldValues ?? [],
        },
        {
          fieldName: 'parentMessageId',
          fieldValues: entries?.find((e) => e.fieldName == 'parentMessageId')?.fieldValues ?? [],
        },
        {
          fieldName: 'createdAt',
          fieldValues: entries?.find((e) => e.fieldName == 'createdAt')?.fieldValues ?? [],
        },
      ],
    });
  };

  const buildMarkdownData = async () => {
    let data =
      '# Conversation\n' +
      `- conversationId: ${conversation?.conversationId}\n` +
      `- endpoint: ${conversation?.endpoint}\n` +
      `- title: ${conversation?.title}\n` +
      `- exportAt: ${new Date().toTimeString()}\n`;

    if (includeOptions === true) {
      data += '\n## Options\n';
      const options = cleanupPreset({ preset: conversation as TPreset });

      for (const key of Object.keys(options)) {
        data += `- ${key}: ${options[key]}\n`;
      }
    }

    const messages = await buildMessageTree({
      messageId: conversation?.conversationId,
      message: null,
      messages: getMessageTree(),
      branches: false,
      recursive: false,
    });

    data += '\n## History\n';
    if (Array.isArray(messages)) {
      for (const message of messages) {
        data += `${formatMessageText({ message, format: 'md', localize })}\n`;
        if (message?.error) {
          data += '*(This is an error message)*\n';
        }
        if (message?.unfinished === true) {
          data += '*(This is an unfinished message)*\n';
        }
        data += '\n\n';
      }
    } else {
      data += `${formatMessageText({ message: messages, format: 'md', localize })}\n`;
      if (messages.error) {
        data += '*(This is an error message)*\n';
      }
      if (messages.unfinished === true) {
        data += '*(This is an unfinished message)*\n';
      }
    }
    return data;
  };

  const exportMarkdown = async () => {
    const data = await buildMarkdownData();
    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'md',
      exportType: exportFromJSON.types.txt,
    });
  };

  const exportHTML = async () => {
    const md = await buildMarkdownData();
    const title = conversation?.title ?? 'Conversation Export';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; margin: 0; padding: 2rem; }
  .container { max-width: 860px; margin: 0 auto; background: #ffffff; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }
  h1, h2, h3 { color: #111827; }
  h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
  h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3rem; margin-top: 1.5rem; }
  pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
  img { max-width: 100%; border-radius: 8px; margin: 1rem 0; }
  blockquote { border-left: 4px solid #3b82f6; margin: 1rem 0; padding-left: 1rem; color: #4b5563; }
  details { background: #f3f4f6; border-radius: 6px; padding: 0.75rem; margin: 1rem 0; }
  summary { font-weight: 600; cursor: pointer; }
  @media print { body { background: white; padding: 0; } .container { box-shadow: none; padding: 0; } }
</style>
<script src="${window.location.origin}/assets/vendor/marked-15.0.12.min.js"></script>
</head>
<body>
<div class="container" id="content"></div>
<script>
  if (typeof marked !== 'undefined') {
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(md)});
  } else {
    document.getElementById('content').innerText = ${JSON.stringify(md)};
  }
</script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    download(blob, `${filename}.html`, 'text/html');
  };

  const exportDoc = async () => {
    const md = await buildMarkdownData();
    const title = conversation?.title ?? 'Conversation';
    const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; }
  h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2pt solid #1e3a8a; padding-bottom: 4pt; margin-bottom: 12pt; }
  h2 { font-size: 14pt; color: #1e40af; border-bottom: 1pt solid #cbd5e1; padding-bottom: 2pt; margin-top: 14pt; }
  h3 { font-size: 12pt; color: #1e293b; }
  pre { background-color: #f1f5f9; padding: 8pt; border: 1pt solid #cbd5e1; font-family: Consolas, monospace; font-size: 9.5pt; }
  blockquote { border-left: 3pt solid #3b82f6; margin-left: 0; padding-left: 10pt; color: #475569; }
  table { border-collapse: collapse; width: 100%; margin-top: 10pt; }
  th, td { border: 1pt solid #cbd5e1; padding: 6pt; text-align: left; }
  th { background-color: #f8fafc; font-weight: bold; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p><em>Exported on ${new Date().toLocaleString()}</em></p>
  <hr/>
  <div style="white-space: pre-wrap; font-family: Calibri, sans-serif;">
${md.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </div>
</body>
</html>`;
    const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });
    download(blob, `${filename}.doc`, 'application/msword');
  };

  const exportPDF = async () => {
    const md = await buildMarkdownData();
    const title = conversation?.title ?? 'Conversation';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      exportHTML();
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta charset="utf-8">
<style>
  @page { margin: 1.5cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; }
  h1 { font-size: 18pt; border-bottom: 2px solid #2563eb; padding-bottom: 4px; color: #1e3a8a; }
  h2 { font-size: 14pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin-top: 16px; color: #1d4ed8; }
  pre { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 8px; border-radius: 4px; font-size: 9.5pt; white-space: pre-wrap; }
  code { font-family: monospace; }
  img { max-width: 100%; height: auto; }
</style>
<script src="${window.location.origin}/assets/vendor/marked-15.0.12.min.js"></script>
</head>
<body>
<div id="content"></div>
<script>
  function render() {
    if (typeof marked !== 'undefined') {
      document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(md)});
    } else {
      document.getElementById('content').innerText = ${JSON.stringify(md)};
    }
    setTimeout(() => {
      window.print();
    }, 500);
  }
  if (document.readyState === 'complete') {
    render();
  } else {
    window.onload = render;
  }
</script>
</body>
</html>`);
    printWindow.document.close();
  };

  const exportText = async () => {
    let data =
      'Conversation\n' +
      '########################\n' +
      `conversationId: ${conversation?.conversationId}\n` +
      `endpoint: ${conversation?.endpoint}\n` +
      `title: ${conversation?.title}\n` +
      `exportAt: ${new Date().toTimeString()}\n`;

    if (includeOptions === true) {
      data += '\nOptions\n########################\n';
      const options = cleanupPreset({ preset: conversation as TPreset });

      for (const key of Object.keys(options)) {
        data += `${key}: ${options[key]}\n`;
      }
    }

    const messages = await buildMessageTree({
      messageId: conversation?.conversationId,
      message: null,
      messages: getMessageTree(),
      branches: false,
      recursive: false,
    });

    data += '\nHistory\n########################\n';
    if (Array.isArray(messages)) {
      for (const message of messages) {
        data += `${formatMessageText({ message, localize })}\n`;
        if (message?.error) {
          data += '(This is an error message)\n';
        }
        if (message?.unfinished === true) {
          data += '(This is an unfinished message)\n';
        }
        data += '\n\n';
      }
    } else {
      data += `${formatMessageText({ message: messages, localize })}\n`;
      if (messages.error) {
        data += '(This is an error message)\n';
      }
      if (messages.unfinished === true) {
        data += '(This is an unfinished message)\n';
      }
    }

    exportFromJSON({
      data: data,
      fileName: filename,
      extension: 'txt',
      exportType: exportFromJSON.types.txt,
    });
  };

  const exportJSON = async () => {
    const data = {
      conversationId: conversation?.conversationId,
      endpoint: conversation?.endpoint,
      title: conversation?.title,
      exportAt: new Date().toTimeString(),
      branches: exportBranches,
      recursive: recursive,
    };

    if (includeOptions === true) {
      data['options'] = cleanupPreset({ preset: conversation as TPreset });
    }

    const messages = await buildMessageTree({
      messageId: conversation?.conversationId,
      message: null,
      messages: getMessageTree(),
      branches: Boolean(exportBranches),
      recursive: Boolean(recursive),
    });

    if (recursive === true && !Array.isArray(messages)) {
      data['messagesTree'] = messages.children;
    } else {
      data['messages'] = messages;
    }

    /** Use JSON.stringify without indentation to minimize file size for deeply nested recursive exports */
    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    download(blob, `${filename}.json`, 'application/json');
  };

  const exportConversation = () => {
    if (type === 'json') {
      exportJSON();
    } else if (type === 'text') {
      exportText();
    } else if (type === 'markdown') {
      exportMarkdown();
    } else if (type === 'html') {
      exportHTML();
    } else if (type === 'doc') {
      exportDoc();
    } else if (type === 'pdf') {
      exportPDF();
    } else if (type === 'csv') {
      exportCSV();
    } else if (type === 'screenshot') {
      exportScreenshot();
    }
  };

  return { exportConversation };
}
