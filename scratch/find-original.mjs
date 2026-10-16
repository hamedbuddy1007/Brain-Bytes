import fs from 'node:fs';
import readline from 'node:readline';

async function searchTranscript() {
  const filePath = 'C:/Users/hamed/.gemini/antigravity-ide/brain/bd815b86-49b0-4c10-ba85-14dbcb5bd536/.system_generated/logs/transcript_full.jsonl';
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let stepCount = 0;
  for await (const line of rl) {
    stepCount++;
    try {
      const data = JSON.parse(line);
      const str = JSON.stringify(data);
      if (str.includes('Round1MCQ.tsx') || str.includes('Round2GraphChallenge.tsx') || str.includes('Round3RapidFire.tsx')) {
        console.log(`Step ${stepCount} type: ${data.type} source: ${data.source}`);
        if (data.tool_calls) {
          for (const tc of data.tool_calls) {
            console.log(`  tool call: ${tc.name || tc.function?.name}`);
            const args = tc.arguments || tc.function?.arguments;
            if (args) {
              const argObj = typeof args === 'string' ? JSON.parse(args) : args;
              if (argObj.TargetFile || argObj.AbsolutePath) {
                console.log(`    target: ${argObj.TargetFile || argObj.AbsolutePath}`);
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

searchTranscript();
