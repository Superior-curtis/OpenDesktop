import { Skill, SkillResult, SkillParam } from '../types'

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map()

  register(skill: Skill): void {
    this.skills.set(skill.id, skill)
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  getByCategory(category: string): Skill[] {
    return this.getAll().filter((s) => s.category === category)
  }

  async execute(id: string, params: Record<string, any>): Promise<SkillResult> {
    const skill = this.get(id)
    if (!skill) {
      return { success: false, output: '', error: `Skill "${id}" not found` }
    }
    try {
      return await skill.execute(params)
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

export const registry = new SkillRegistry()
