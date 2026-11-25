// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../../../frontend/src/context/auth-context';
import { ToastProvider } from '../../../frontend/src/context/ToastContext';
import EmployerAvailabilityPage from '../../../frontend/src/pages/EmployerAvailabilityPage';

function renderAvailability() {
  const writes: { start_time: string; end_time: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init?: RequestInit) => {
    if (init?.method === 'GET') return Response.json([]);
    const payload = JSON.parse(String(init?.body));
    writes.push(payload);
    return Response.json({ id: 'slot', ...payload, is_booked: false });
  }));

  const view = render(
    <AuthContext.Provider value={{
      user: { id: 'employer-1', role: 'Employer', email: 'hr@demo.test', display_name: 'HR', created_at: '' },
      isLoading: false, login: async () => {}, register: async () => {},
      logout: async () => {}, previewAs: () => {},
    }}>
      <ToastProvider><EmployerAvailabilityPage /></ToastProvider>
    </AuthContext.Provider>,
  );
  return { ...view, writes };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('rejects a nonexistent daylight-saving wall time without silently changing it', async () => {
  vi.stubEnv('TZ', 'America/Los_Angeles');
  vi.setSystemTime(new Date('2027-03-13T12:00:00Z'));
  const view = renderAvailability();
  const start = await view.findByLabelText('Slot start time');
  fireEvent.change(start, { target: { value: '2027-03-14T02:30' } });
  fireEvent.submit(start.closest('form')!);

  await view.findByText(/does not exist in your time zone/i);
  expect(view.writes).toEqual([]);
  expect((start as HTMLInputElement).value).toBe('2027-03-14T02:30');
});

it('distinguishes both offsets of a repeated time and allows the future occurrence', async () => {
  vi.stubEnv('TZ', 'America/Los_Angeles');
  vi.setSystemTime(new Date('2027-11-07T09:10:00Z'));
  const view = renderAvailability();
  const start = await view.findByLabelText('Slot start time');
  fireEvent.change(start, { target: { value: '2027-11-07T01:30' } });
  const select = view.getByLabelText<HTMLSelectElement>(/Time zone offset/i);
  expect(view.getByRole<HTMLOptionElement>('option', { name: /UTC-07:00/ }).disabled).toBe(true);
  const second = view.getByRole<HTMLOptionElement>('option', { name: /UTC-08:00/ });
  expect(second.disabled).toBe(false);
  fireEvent.change(select, { target: { value: second.value } });
  fireEvent.submit(start.closest('form')!);

  await view.findByText('Availability slot added');
  expect(view.writes).toEqual([{ start_time: '2027-11-07T09:30:00.000Z', end_time: '2027-11-07T10:00:00.000Z' }]);
});

it('preserves partial and cleared time inputs while editing', async () => {
  const view = renderAvailability();
  const start = await view.findByLabelText<HTMLInputElement>('Slot start time');
  fireEvent.change(start, { target: { value: '2030-05-05T10:03' } });
  expect(start.value).toBe('2030-05-05T10:03');
  fireEvent.change(start, { target: { value: '' } });
  fireEvent.blur(start);
  expect(start.value).toBe('');
});

it('reports a successful slot save when crypto.randomUUID is unavailable', async () => {
  vi.stubGlobal('crypto', {});
  const view = renderAvailability();
  const start = await view.findByLabelText('Slot start time');
  fireEvent.submit(start.closest('form')!);
  await view.findByText('Availability slot added');
  expect(view.queryByText(/Could not create slot/i)).toBeNull();
  expect(view.writes).toHaveLength(1);
});
