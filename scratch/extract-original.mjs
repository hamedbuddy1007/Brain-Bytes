import fs from 'node:fs';
import readline from 'node:readline';

async function extractFiles() {
  const filePath = 'C:/Users/hamed/.gemini/antigravity-ide/brain/bd815b86-49b0-4c10-ba85-14dbcb5bd536/.system_generated/logs/transcript_full.jsonl';
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let stepCount = 0;
  for await (const line of rl) {
    stepCount++;
    if (stepCount >= 160 && stepCount <= 226) {
      try {
        const data = JSON.parse(line);
        if (data.type === 'PLANNER_RESPONSE' && data.tool_calls) {
          for (const tc of data.tool_calls) {
            console.log(`Step ${stepCount} tool: ${tc.name || tc.function?.name}`);
            const args = tc.arguments || tc.function?.arguments;
            const argObj = typeof args === 'string' ? JSON.parse(args) : args;
            console.log('  args summary:', {
              file: argObj.TargetFile || argObj.AbsolutePath,
              start: argObj.StartLine,
              end: argObj.EndLine,
              desc: argObj.Description,
              toolAction: argObj.toolAction
            });
          }
        }
      } catch (e) {}
    }
  }
}

extractFiles();
