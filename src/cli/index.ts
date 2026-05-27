#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { initNodeIO } from './NodeIOProvider'
import { io } from '../core/CoreContext'

async function main() {
  initNodeIO()
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'))
  console.log(`\n  OpenDesktop CLI v${pkg.version || '0.0.0'}`)
  console.log(`  Type /help for commands, Ctrl+C to exit\n`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  })

  rl.prompt()

  for await (const line of rl) {
    const input = line.trim()
    if (!input) { rl.prompt(); continue }
    if (input === '/quit' || input === '/exit') break
    if (input === '/help') {
      console.log(`\n  Commands:`)
      console.log(`    /help          Show this help`)
      console.log(`    /exit, /quit   Exit the CLI`)
      console.log(`    /clear         Clear screen`)
      console.log(`    /compact       Compact conversation context`)
      console.log(`    /memory        List stored memories`)
      console.log(`    /todos         List active tasks`)
      console.log(`    /providers     Show configured providers`)
      console.log(`    /io            Show IO provider status`)
      console.log(`\n  Type anything else to start a conversation.\n`)
      rl.prompt()
      continue
    }
    if (input === '/clear') {
      console.clear()
      rl.prompt()
      continue
    }
    if (input === '/io') {
      try {
        const prov = io()
        console.log(`\n  IO Provider: OK`)
        console.log(`  Platform: ${prov.platformInfo.platform}`)
        console.log(`  CWD: ${prov.platformInfo.cwd}`)
        console.log(`  Home: ${prov.platformInfo.homeDir}\n`)
      } catch (e: any) {
        console.log(`\n  IO Provider: NOT SET - ${e.message}\n`)
      }
      rl.prompt()
      continue
    }

    console.log(`\n  [echo] ${input}\n`)
    rl.prompt()
  }

  rl.close()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
