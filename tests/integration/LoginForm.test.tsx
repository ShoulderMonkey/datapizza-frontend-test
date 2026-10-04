import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { loginValidationErrorBody } from '@/src/mocks/handlers';
import { LoginForm } from '@/src/features/auth/components/LoginForm';

describe('LoginForm 422 mapping', () => {
  it('shows an Italian message, not the Pydantic msg, on 422', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(loginValidationErrorBody('test_user'), { status: 422 })
      )
    );
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onLoginSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: /accedi all/i }));

    const alert = await screen.findByText(/User ID non valido/i);
    expect(alert).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Value error/);
    expect(document.body.textContent).not.toMatch(/alphanumeric/);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(
      consoleSpy.mock.calls.some((c) => JSON.stringify(c, (_k, v) => (v instanceof Error ? v.message : v)).includes('Value error'))
    ).toBe(true);
    consoleSpy.mockRestore();
  });

  it('blocks a 101-char user_id client-side with a length message', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<LoginForm onLoginSuccess={onSuccess} />);
    const input = screen.getByLabelText('User ID');
    await user.clear(input);
    await user.click(input);
    await user.paste('a'.repeat(101));
    await user.click(screen.getByRole('button', { name: /accedi all/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/100 caratteri/);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('accepts a 100-char user_id and calls onLoginSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<LoginForm onLoginSuccess={onSuccess} />);
    const input = screen.getByLabelText('User ID');
    await user.clear(input);
    await user.click(input);
    await user.paste('a'.repeat(100));
    await user.click(screen.getByRole('button', { name: /accedi all/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('a'.repeat(100)));
  });
});
