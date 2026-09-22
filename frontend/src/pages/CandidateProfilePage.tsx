import { useState } from 'react';
import { AppShell } from '@/layouts/AppShell';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SkillTagInput } from '@/components/ui/SkillTagInput';
import { Card } from '@/components/ui/Card';
import { candidateProfile } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function CandidateProfilePage({ user }: { user: AuthUser }) {
  const [displayName, setDisplayName] = useState(candidateProfile.display_name);
  const [skills, setSkills] = useState<string[]>(candidateProfile.skills);
  const [resume, setResume] = useState(candidateProfile.resume_text);
  const [saved, setSaved] = useState<string | null>(null);

  async function handleSave(section: string) {
    // TODO: Replace with real API call
    await new Promise((r) => setTimeout(r, 400));
    setSaved(section);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <AppShell user={user}>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">My Profile</h1>
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Display Name</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Display name"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Button
              size="sm"
              className="self-start"
              onClick={() => handleSave('displayName')}
            >
              Save
            </Button>
            {saved === 'displayName' && (
              <p className="text-sm text-success">Display name saved.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Skills</h2>
          <div className="flex flex-col gap-4">
            <SkillTagInput
              label="Technical skills"
              skills={skills}
              onChange={setSkills}
              placeholder="e.g. Python, SQL, Docker"
            />
            <Button
              size="sm"
              className="self-start"
              onClick={() => handleSave('skills')}
            >
              Save Skills
            </Button>
            {saved === 'skills' && (
              <p className="text-sm text-success">Skills saved.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Resume</h2>
          <div className="flex flex-col gap-4">
            <Textarea
              label="Raw resume text"
              name="resume"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              className="min-h-[16rem]"
              required
            />
            <Button
              size="sm"
              className="self-start"
              onClick={() => handleSave('resume')}
            >
              Save Resume
            </Button>
            {saved === 'resume' && (
              <p className="text-sm text-success">Resume saved.</p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
