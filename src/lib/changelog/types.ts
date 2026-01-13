export interface ChangelogRelease {
  version: string;
  date: string;
  title?: string;
  sections: {
    added?: string[];
    changed?: string[];
    fixed?: string[];
    removed?: string[];
    deprecated?: string[];
    security?: string[];
  };
}

export type SectionType = keyof ChangelogRelease['sections'];
