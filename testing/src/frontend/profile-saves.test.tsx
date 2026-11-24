// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../../frontend/src/context/auth-context';
import CandidateProfilePage from '../../../frontend/src/pages/CandidateProfilePage';
import EmployerProfilePage from '../../../frontend/src/pages/EmployerProfilePage';

const auth = {
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  previewAs: () => {},
};

const profiles = [
  {
    role: 'Candidate' as const,
    Page: CandidateProfilePage,
    field: /Display name/i,
    button: 'Save profile changes',
    nameKey: 'display_name',
    data: { user_id: 'user-1', display_name: 'Existing name', skills: ['python'], resume_text: 'Existing résumé' },
  },
  {
    role: 'Employer' as const,
    Page: EmployerProfilePage,
    field: /Company name/i,
    button: 'Save profile',
    nameKey: 'company_name',
    data: { user_id: 'user-1', company_name: 'Existing name', description: 'Existing description' },
  },
];

function renderProfile(Page: typeof CandidateProfilePage, role: 'Candidate' | 'Employer') {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{
        ...auth,
        user: { id: 'user-1', role, display_name: 'Existing name', email: 'person@demo.test', created_at: '' },
      }}>
        <Page />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(profiles)('$role profile must load successfully before replacing saved data', async ({
  Page, role, field, button, nameKey, data,
}) => {
  const writes: unknown[] = [];
  let reads = 0;
  vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body));
      writes.push(payload);
      return Response.json({ ...data, ...payload });
    }
    reads += 1;
    return reads === 1
      ? Response.json({ error: { code: 'DB_UNAVAILABLE', message: 'Try later' } }, { status: 503 })
      : Response.json(data);
  }));

  const view = renderProfile(Page, role);
  await view.findByText(/Could not load profile/i);
  const name = view.queryByLabelText(field);
  if (name) fireEvent.change(name, { target: { value: 'New name' } });
  expect(view.queryByRole<HTMLButtonElement>('button', { name: button, exact: true })?.disabled ?? true).toBe(true);
  expect(writes).toEqual([]);

  fireEvent.click(view.getByRole('button', { name: 'Retry' }));
  const loadedName = await view.findByDisplayValue('Existing name');
  fireEvent.change(loadedName, { target: { value: 'New name' } });
  fireEvent.click(view.getByRole('button', { name: button, exact: true }));

  await view.findByText(/profile saved\./i);
  const { user_id: _userId, ...saved } = data;
  expect(writes).toEqual([{ ...saved, [nameKey]: 'New name' }]);
});

it.each(profiles)('$role draft fields are protected while a save is pending', async ({
  Page, role, button, nameKey, data,
}) => {
  let finishSave!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { finishSave = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) =>
    init?.method === 'PUT' ? pending : Response.json(data),
  ));

  const view = renderProfile(Page, role);
  const name = await view.findByDisplayValue<HTMLInputElement>('Existing name');
  const text = view.getByDisplayValue<HTMLTextAreaElement>('resume_text' in data ? data.resume_text! : data.description!);
  fireEvent.change(name, { target: { value: 'Submitted name' } });
  fireEvent.click(view.getByRole('button', { name: button, exact: true }));
  expect(name.disabled).toBe(true);
  expect(text.disabled).toBe(true);
  if (role === 'Candidate') {
    expect(view.getByPlaceholderText<HTMLInputElement>('e.g. Python').disabled).toBe(true);
    expect(view.getByRole<HTMLButtonElement>('button', { name: 'Remove python' }).disabled).toBe(true);
  }

  finishSave(Response.json({ ...data, [nameKey]: 'Submitted name' }));
  await view.findByText(/profile saved\./i);
  expect(name.disabled).toBe(false);
  expect(text.disabled).toBe(false);
});
