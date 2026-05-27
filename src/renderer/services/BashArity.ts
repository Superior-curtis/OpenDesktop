import { type ParsedCommand, type CommandClassification, parseShellCommand } from './BashParser'

export interface ArityEntry {
  command: string
  hasSubcommands: boolean
  knownSubcommands?: string[]
  maxArgs?: number
  isDangerous?: boolean
}

export type ArityRecord = Record<string, ArityEntry>

const ARITY_MAP: ArityRecord = {
  // ===== Simple commands (no subcommands) =====
  cat: { command: 'cat', hasSubcommands: false, maxArgs: undefined },
  cd: { command: 'cd', hasSubcommands: false, maxArgs: 1 },
  chmod: { command: 'chmod', hasSubcommands: false },
  chown: { command: 'chown', hasSubcommands: false },
  cp: { command: 'cp', hasSubcommands: false },
  curl: { command: 'curl', hasSubcommands: false },
  dd: { command: 'dd', hasSubcommands: false, isDangerous: true },
  echo: { command: 'echo', hasSubcommands: false },
  env: { command: 'env', hasSubcommands: false },
  export: { command: 'export', hasSubcommands: false },
  grep: { command: 'grep', hasSubcommands: false },
  kill: { command: 'kill', hasSubcommands: false },
  killall: { command: 'killall', hasSubcommands: false },
  ln: { command: 'ln', hasSubcommands: false },
  ls: { command: 'ls', hasSubcommands: false },
  mkdir: { command: 'mkdir', hasSubcommands: false },
  mv: { command: 'mv', hasSubcommands: false },
  ps: { command: 'ps', hasSubcommands: false },
  pwd: { command: 'pwd', hasSubcommands: false },
  rm: { command: 'rm', hasSubcommands: false, isDangerous: true },
  rmdir: { command: 'rmdir', hasSubcommands: false },
  rsync: { command: 'rsync', hasSubcommands: false },
  scp: { command: 'scp', hasSubcommands: false },
  sleep: { command: 'sleep', hasSubcommands: false },
  source: { command: 'source', hasSubcommands: false },
  ssh: { command: 'ssh', hasSubcommands: false },
  tail: { command: 'tail', hasSubcommands: false },
  touch: { command: 'touch', hasSubcommands: false },
  unset: { command: 'unset', hasSubcommands: false },
  wget: { command: 'wget', hasSubcommands: false },
  which: { command: 'which', hasSubcommands: false },

  // ===== Dangerous system commands =====
  format: { command: 'format', hasSubcommands: false, isDangerous: true },
  mkfs: { command: 'mkfs', hasSubcommands: false, isDangerous: true },
  'mkfs.ext4': { command: 'mkfs.ext4', hasSubcommands: false, isDangerous: true },
  'mkfs.btrfs': { command: 'mkfs.btrfs', hasSubcommands: false, isDangerous: true },
  'mkfs.xfs': { command: 'mkfs.xfs', hasSubcommands: false, isDangerous: true },
  'mkfs.fat': { command: 'mkfs.fat', hasSubcommands: false, isDangerous: true },
  shutdown: { command: 'shutdown', hasSubcommands: false, isDangerous: true },
  reboot: { command: 'reboot', hasSubcommands: false, isDangerous: true },
  halt: { command: 'halt', hasSubcommands: false, isDangerous: true },
  poweroff: { command: 'poweroff', hasSubcommands: false, isDangerous: true },

  // ===== git =====
  git: {
    command: 'git', hasSubcommands: true,
    knownSubcommands: [
      'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'merge', 'rebase',
      'reset', 'log', 'diff', 'stash', 'tag', 'fetch', 'clone', 'remote', 'config',
      'rm', 'mv', 'restore', 'switch', 'worktree', 'cherry-pick', 'revert', 'bisect',
      'clean', 'gc', 'submodule', 'notes', 'archive', 'bundle', 'describe', 'fsck',
      'grep', 'help', 'init', 'instaweb', 'prune', 'reflog', 'replace', 'request-pull',
      'shortlog', 'show', 'show-branch', 'status', 'verify-commit', 'verify-tag',
      'whatchanged',
    ],
  },
  'git config': { command: 'git config', hasSubcommands: false },
  'git remote': { command: 'git remote', hasSubcommands: false },
  'git stash': { command: 'git stash', hasSubcommands: false },

  // ===== npm =====
  npm: {
    command: 'npm', hasSubcommands: true,
    knownSubcommands: [
      'install', 'uninstall', 'update', 'run', 'test', 'publish', 'pack', 'audit',
      'ci', 'init', 'link', 'outdated', 'prune', 'rebuild', 'restart', 'start', 'stop',
      'ls', 'config', 'cache', 'exec', 'create', 'deprecate', 'dist-tag', 'docs',
      'edit', 'explain', 'fund', 'help', 'hook', 'info', 'login', 'logout', 'org',
      'owner', 'ping', 'pkg', 'prefix', 'profile', 'query', 'repo', 'root', 'search',
      'shrinkwrap', 'star', 'stars', 'team', 'token', 'unpublish', 'unstar',
      'version', 'view', 'whoami',
    ],
  },
  'npm run': { command: 'npm run', hasSubcommands: true },
  'npm exec': { command: 'npm exec', hasSubcommands: true },
  'npm init': { command: 'npm init', hasSubcommands: true },
  'npm view': { command: 'npm view', hasSubcommands: true },
  'npm config': { command: 'npm config', hasSubcommands: false },
  'npm cache': { command: 'npm cache', hasSubcommands: false },

  // ===== npx =====
  npx: {
    command: 'npx', hasSubcommands: true,
    knownSubcommands: [
      'install', 'uninstall', 'update', 'run', 'test', 'publish', 'pack', 'audit',
      'ci', 'init', 'link', 'outdated', 'prune', 'rebuild', 'restart', 'start', 'stop',
      'ls', 'config', 'cache', 'exec', 'create', 'deprecate', 'dist-tag', 'docs',
      'edit', 'explain', 'fund', 'help', 'hook', 'info', 'login', 'logout', 'org',
      'owner', 'ping', 'pkg', 'prefix', 'profile', 'query', 'repo', 'root', 'search',
      'shrinkwrap', 'star', 'stars', 'team', 'token', 'unpublish', 'unstar',
      'version', 'view', 'whoami',
    ],
  },

  // ===== yarn =====
  yarn: {
    command: 'yarn', hasSubcommands: true,
    knownSubcommands: [
      'add', 'remove', 'install', 'run', 'test', 'build', 'start', 'create',
      'workspace', 'workspaces', 'why', 'audit', 'autoclean', 'bin', 'cache',
      'check', 'config', 'constraints', 'dedupe', 'dlx', 'exec', 'explain',
      'info', 'init', 'link', 'list', 'npm', 'pack', 'patch', 'plugin',
      'policies', 'rebuild', 'set', 'upgrade', 'version', 'whoami', 'worktree',
    ],
  },
  'yarn run': { command: 'yarn run', hasSubcommands: true },
  'yarn dlx': { command: 'yarn dlx', hasSubcommands: true },
  'yarn workspaces': { command: 'yarn workspaces', hasSubcommands: false },

  // ===== pnpm =====
  pnpm: {
    command: 'pnpm', hasSubcommands: true,
    knownSubcommands: [
      'install', 'add', 'remove', 'update', 'run', 'test', 'start', 'build',
      'audit', 'ci', 'config', 'create', 'deploy', 'dlx', 'env', 'exec', 'fetch',
      'import', 'init', 'link', 'list', 'migrate', 'outdated', 'pack', 'patch',
      'publish', 'rebuild', 'recursive', 'root', 'server', 'setup', 'store',
      'tail', 'unlink', 'upgrade', 'why',
    ],
  },
  'pnpm run': { command: 'pnpm run', hasSubcommands: true },
  'pnpm exec': { command: 'pnpm exec', hasSubcommands: true },
  'pnpm dlx': { command: 'pnpm dlx', hasSubcommands: true },

  // ===== docker =====
  docker: {
    command: 'docker', hasSubcommands: true,
    knownSubcommands: [
      'run', 'exec', 'ps', 'build', 'pull', 'push', 'images', 'logs', 'stop',
      'start', 'restart', 'rm', 'rmi', 'tag', 'commit', 'cp', 'diff', 'export',
      'import', 'inspect', 'kill', 'load', 'login', 'logout', 'network', 'node',
      'pause', 'plugin', 'port', 'rename', 'save', 'search', 'secret', 'service',
      'stack', 'stats', 'swarm', 'system', 'top', 'trust', 'unpause', 'update',
      'version', 'volume', 'wait',
    ],
  },
  'docker container': { command: 'docker container', hasSubcommands: true },
  'docker image': { command: 'docker image', hasSubcommands: true },
  'docker volume': { command: 'docker volume', hasSubcommands: true },
  'docker network': { command: 'docker network', hasSubcommands: true },
  'docker builder': { command: 'docker builder', hasSubcommands: true },
  'docker compose': { command: 'docker compose', hasSubcommands: true },

  // ===== kubectl =====
  kubectl: {
    command: 'kubectl', hasSubcommands: true,
    knownSubcommands: [
      'get', 'describe', 'create', 'apply', 'delete', 'logs', 'exec',
      'port-forward', 'proxy', 'top', 'explain', 'edit', 'patch', 'replace',
      'rollout', 'scale', 'autoscale', 'cordon', 'uncordon', 'drain', 'taint',
      'annotate', 'label', 'config', 'cluster-info', 'cp', 'auth', 'cert',
      'completion', 'convert', 'diff', 'events', 'kustomize', 'options',
      'plugin', 'quit', 'run', 'set', 'version', 'wait',
    ],
  },
  'kubectl rollout': { command: 'kubectl rollout', hasSubcommands: true },
  'kubectl kustomize': { command: 'kubectl kustomize', hasSubcommands: false },

  // ===== pip =====
  pip: {
    command: 'pip', hasSubcommands: true,
    knownSubcommands: [
      'install', 'uninstall', 'list', 'show', 'freeze', 'check', 'download',
      'search', 'cache', 'config', 'compile', 'debug', 'help', 'index',
      'inspect', 'reinstall', 'requirements', 'run', 'sync', 'validate',
    ],
  },

  // ===== cargo =====
  cargo: {
    command: 'cargo', hasSubcommands: true,
    knownSubcommands: [
      'build', 'run', 'test', 'check', 'clean', 'doc', 'publish', 'install',
      'update', 'add', 'remove', 'init', 'new', 'bench', 'clippy', 'fix', 'fmt',
      'generate', 'help', 'locate-project', 'login', 'logout', 'metadata',
      'owner', 'package', 'pkgid', 'pkginfo', 'read-manifest', 'report',
      'rustc', 'rustdoc', 'search', 'tree', 'uninstall', 'vendor',
      'verify-project', 'version', 'yank',
    ],
  },
  'cargo run': { command: 'cargo run', hasSubcommands: true },
  'cargo add': { command: 'cargo add', hasSubcommands: false },

  // ===== go =====
  go: {
    command: 'go', hasSubcommands: true,
    knownSubcommands: [
      'build', 'run', 'test', 'mod', 'get', 'install', 'clean', 'doc', 'env',
      'bug', 'fix', 'fmt', 'generate', 'list', 'tool', 'version', 'vet',
      'work', 'workspace',
    ],
  },

  // ===== brew =====
  brew: {
    command: 'brew', hasSubcommands: true,
    knownSubcommands: [
      'install', 'uninstall', 'update', 'upgrade', 'list', 'search', 'info',
      'doctor', 'cleanup', 'tap', 'untap', 'outdated', 'pin', 'unpin',
      'services', 'bundle', 'config', 'deps', 'desc', 'link', 'unlink',
      'options', 'leaves', 'uses', 'reinstall', 'readall', 'migrate',
      'shellenv', 'update-report', 'vendor-install', 'analytics', 'autoremove',
      'cat', 'command', 'completions', 'diy', 'dispatch', 'edit', 'environment',
      'fetch', 'gist-logs', 'help', 'home', 'install-bundled-gems', 'irb',
      'livecheck', 'log', 'missing', 'nil',
    ],
  },
  'brew services': { command: 'brew services', hasSubcommands: true },

  // ===== systemctl =====
  systemctl: {
    command: 'systemctl', hasSubcommands: true,
    knownSubcommands: [
      'start', 'stop', 'restart', 'status', 'enable', 'disable', 'is-active',
      'is-enabled', 'is-failed', 'list-units', 'list-unit-files',
      'daemon-reload', 'reload', 'mask', 'unmask', 'cat', 'edit', 'show',
      'help', 'get-default', 'set-default', 'list-dependencies', 'list-jobs',
      'list-machines', 'list-sockets', 'list-timers', 'show-environment',
      'add-wants', 'add-requires', 'cancel', 'condreload', 'condrestart',
      'isolate', 'kill', 'kexec', 'link', 'load', 'mount', 'no-block',
      'poweroff', 'reboot', 'reenable', 'reload-or-restart', 'reset-failed',
      'rescue', 'set-environment', 'set-property', 'snapshot', 'switch-root',
      'suspend', 'try-restart', 'unset-environment',
    ],
  },

  // ===== apt =====
  apt: {
    command: 'apt', hasSubcommands: true,
    knownSubcommands: [
      'install', 'remove', 'update', 'upgrade', 'dist-upgrade', 'list',
      'search', 'show', 'autoremove', 'autoclean', 'clean', 'full-upgrade',
      'depends', 'download', 'changelog', 'edit-sources', 'hold', 'mark',
      'policy', 'purge', 'satisfies', 'unhold', 'reinstall',
    ],
  },

  // ===== apt-get =====
  'apt-get': {
    command: 'apt-get', hasSubcommands: true,
    knownSubcommands: [
      'install', 'remove', 'update', 'upgrade', 'dist-upgrade', 'clean',
      'autoclean', 'autoremove', 'check', 'source', 'build-dep', 'download',
      'changelog',
    ],
  },

  // ===== gh =====
  gh: {
    command: 'gh', hasSubcommands: true,
    knownSubcommands: [
      'repo', 'pr', 'issue', 'release', 'workflow', 'run', 'secret',
      'variable', 'gist', 'codespace', 'extension', 'search', 'auth',
      'browse', 'api', 'label', 'project', 'status', 'config', 'help',
    ],
  },
  'gh pr': { command: 'gh pr', hasSubcommands: true },
  'gh issue': { command: 'gh issue', hasSubcommands: true },
  'gh release': { command: 'gh release', hasSubcommands: true },
  'gh repo': { command: 'gh repo', hasSubcommands: true },
  'gh run': { command: 'gh run', hasSubcommands: true },
  'gh workflow': { command: 'gh workflow', hasSubcommands: true },

  // ===== nix =====
  nix: {
    command: 'nix', hasSubcommands: true,
    knownSubcommands: [
      'develop', 'build', 'run', 'shell', 'flake', 'profile', 'store',
      'search', 'eval', 'bundle', 'edit', 'fmt', 'hash', 'key', 'log',
      'narcat', 'path-info', 'ping', 'prefetch-url', 'realise', 'registry',
      'repl', 'resolve', 'sig', 'store-copy-log', 'store-delete',
      'store-diff-closures', 'store-gc', 'store-ls', 'store-status',
      'store-verify', 'upgrade-nix', 'why-depends',
    ],
  },

  // ===== aws =====
  aws: {
    command: 'aws', hasSubcommands: true,
    knownSubcommands: [
      's3', 's3api', 'ec2', 'lambda', 'iam', 'cloudformation', 'dynamodb',
      'ssm', 'logs', 'route53', 'organizations', 'sts', 'kms', 'sns', 'sqs',
      'elasticache', 'rds', 'elasticbeanstalk', 'ecs', 'eks', 'apprunner',
      'batch', 'cloudfront', 'cloudwatch', 'codebuild', 'codecommit',
      'codedeploy', 'codepipeline', 'cognito', 'config', 'comprehend',
      'datapipeline', 'devicefarm', 'directconnect', 'discovery', 'dms', 'ds',
      'efs', 'emr', 'es', 'events', 'firehose', 'gamelift', 'glacier', 'glue',
      'greengrass', 'health', 'inspector', 'iot', 'kinesis',
      'kinesisanalytics', 'lex', 'lightsail', 'machinelearning', 'macie',
      'marketplace', 'mediaconvert', 'mediapackage', 'medialive', 'media',
      'mgh', 'migrationhub', 'mobile', 'mq', 'mturk', 'opsworks', 'pi',
      'pinpoint', 'polly', 'pricing', 'quicksight', 'ram', 'redshift',
      'rekognition', 'resource-groups', 'robomaker', 'route53domains',
      'sagemaker', 'sdb', 'secretsmanager', 'serverlessrepo', 'servicecatalog',
      'servicediscovery', 'shield', 'stepfunctions', 'storagegateway',
      'support', 'swf', 'textract', 'transcribe', 'transfer', 'translate',
      'trustedadvisor', 'waf', 'waf-regional', 'wafv2', 'workdocs',
      'worklink', 'workmail', 'workspaces', 'xray',
    ],
  },
  'aws s3': { command: 'aws s3', hasSubcommands: true },

  // ===== python / python3 =====
  python: {
    command: 'python', hasSubcommands: true,
    knownSubcommands: ['-m', '-c', '-V', '--version'],
  },
  python3: {
    command: 'python3', hasSubcommands: true,
    knownSubcommands: ['-m', '-c', '-V', '--version'],
  },
  'python -m': { command: 'python -m', hasSubcommands: true },

  // ===== node =====
  node: {
    command: 'node', hasSubcommands: true,
    knownSubcommands: ['-e', '-p', '--run', '--test'],
  },
  'node -e': { command: 'node -e', hasSubcommands: false },

  // ===== deno =====
  deno: {
    command: 'deno', hasSubcommands: true,
    knownSubcommands: [
      'run', 'test', 'compile', 'bundle', 'lint', 'fmt', 'task', 'cache',
      'info', 'eval', 'bench', 'doc', 'check', 'completions', 'coverage',
      'init', 'install', 'json', 'jupyter', 'types', 'uninstall', 'upgrade',
      'vendor',
    ],
  },
  'deno task': { command: 'deno task', hasSubcommands: true },

  // ===== bun =====
  bun: {
    command: 'bun', hasSubcommands: true,
    knownSubcommands: [
      'run', 'test', 'install', 'add', 'remove', 'update', 'build', 'dev',
      'create', 'init', 'lint', 'fmt', 'pm', 'bunx', 'completions', 'discard',
      'help', 'hash', 'info', 'publish', 'shell', 'upgrade', 'why', 'x',
    ],
  },
  'bun run': { command: 'bun run', hasSubcommands: true },
  'bun x': { command: 'bun x', hasSubcommands: true },

  // ===== make =====
  make: { command: 'make', hasSubcommands: false },

  // ===== terraform =====
  terraform: {
    command: 'terraform', hasSubcommands: true,
    knownSubcommands: [
      'init', 'plan', 'apply', 'destroy', 'validate', 'fmt', 'show', 'output',
      'state', 'import', 'taint', 'untaint', 'workspace', 'providers',
      'force-unlock', 'get', 'graph', 'login', 'logout', 'metadata',
      'platform', 'refresh', 'test', 'version',
    ],
  },
  'terraform workspace': { command: 'terraform workspace', hasSubcommands: true },
}

export interface ResolveResult {
  command: string
  depth: number
  subcommandPath: string[]
  known: boolean
  dangerous: boolean
}

export class ArityResolver {
  private arityMap: ArityRecord

  constructor(arityMap?: ArityRecord) {
    this.arityMap = arityMap ?? ARITY_MAP
  }

  resolve(tokens: string[]): ResolveResult {
    if (tokens.length === 0 || tokens[0] === '') {
      return { command: '', depth: 0, subcommandPath: [], known: false, dangerous: false }
    }

    const firstToken = tokens[0]
    const baseKnown = firstToken in this.arityMap

    for (let len = tokens.length; len > 0; len--) {
      const prefix = tokens.slice(0, len).join(' ')
      const entry = this.arityMap[prefix]
      if (entry) {
        const prefixWordCount = prefix.split(' ').length
        const depth = prefixWordCount + (entry.hasSubcommands ? 1 : 0)
        const subcommandPath = tokens.slice(0, depth)
        return {
          command: subcommandPath.join(' '),
          depth,
          subcommandPath,
          known: baseKnown,
          dangerous: entry.isDangerous ?? false,
        }
      }
    }

    return {
      command: firstToken,
      depth: 1,
      subcommandPath: [firstToken],
      known: false,
      dangerous: false,
    }
  }

  classify(tokens: string[]): 'safe' | 'moderate' | 'dangerous' | 'unknown' {
    const resolved = this.resolve(tokens)
    if (!resolved.known) return 'unknown'
    if (resolved.dangerous) return 'dangerous'

    const entry = this.arityMap[resolved.subcommandPath.join(' ')]
    if (entry && entry.hasSubcommands) return 'moderate'

    return 'safe'
  }

  getEntry(command: string): ArityEntry | undefined {
    return this.arityMap[command]
  }

  getSubcommandPath(tokens: string[]): string[] {
    return this.resolve(tokens).subcommandPath
  }
}

export const defaultArityResolver = new ArityResolver()

export function enrichCommandClassification(
  parsed: ParsedCommand,
  arityResolver: ArityResolver,
): CommandClassification {
  const tokens = parsed.command ? [parsed.command, ...parsed.args] : []
  const resolved = arityResolver.resolve(tokens)
  const risk = arityResolver.classify(tokens)

  let category = resolved.known ? resolved.command : (parsed.command || 'unknown')

  if (risk === 'dangerous') {
    return { category, risk: 'dangerous', isReadOnly: false, isDestructive: true }
  }

  if (risk === 'safe') {
    return { category, risk: 'safe', isReadOnly: true, isDestructive: false }
  }

  if (risk === 'unknown') {
    return { category, risk: 'moderate', isReadOnly: false, isDestructive: false }
  }

  const hasOutputRedirect = parsed.redirects.some(r =>
    r.type === 'output' || r.type === 'append' || r.type === 'error' || r.type === 'error-append',
  )

  return {
    category,
    risk: hasOutputRedirect ? 'moderate' : 'moderate',
    isReadOnly: false,
    isDestructive: hasOutputRedirect,
  }
}

export function getPermissionCommand(command: string): string {
  const parsed = parseShellCommand(command)
  const tokens = parsed.command ? [parsed.command, ...parsed.args] : []
  const resolved = defaultArityResolver.resolve(tokens)
  return resolved.command || command
}
