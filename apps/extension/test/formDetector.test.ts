import { beforeEach, describe, expect, it } from "vitest";
import { fillLoginForm, findLoginForm } from "../src/content/formDetector";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("findLoginForm", () => {
  it("detects a standard username + password form", () => {
    document.body.innerHTML = `
      <form id="login">
        <input type="text" name="username" id="username" />
        <input type="password" name="password" id="password" />
        <button type="submit">Log in</button>
      </form>
    `;
    const detected = findLoginForm(document);
    expect(detected).not.toBeNull();
    expect(detected!.formEl?.id).toBe("login");
    expect(detected!.passwordInput.id).toBe("password");
    expect(detected!.usernameInput?.id).toBe("username");
  });

  it("detects an email + password form via autocomplete hints", () => {
    document.body.innerHTML = `
      <form>
        <input type="email" autocomplete="username" id="email" />
        <input type="password" autocomplete="current-password" id="pw" />
      </form>
    `;
    const detected = findLoginForm(document);
    expect(detected?.usernameInput?.id).toBe("email");
    expect(detected?.passwordInput.id).toBe("pw");
  });

  it("handles a password-only form (no username field)", () => {
    document.body.innerHTML = `<form><input type="password" id="pw" /></form>`;
    const detected = findLoginForm(document);
    expect(detected?.passwordInput.id).toBe("pw");
    expect(detected?.usernameInput).toBeNull();
  });

  it("falls back to document scope when there is no wrapping <form>", () => {
    document.body.innerHTML = `
      <div>
        <input type="text" id="user" />
        <input type="password" id="pw" />
      </div>
    `;
    const detected = findLoginForm(document);
    expect(detected?.formEl).toBeNull();
    expect(detected?.usernameInput?.id).toBe("user");
    expect(detected?.passwordInput.id).toBe("pw");
  });

  it("returns null when there is no password field on the page", () => {
    document.body.innerHTML = `<form><input type="text" id="user" /></form>`;
    expect(findLoginForm(document)).toBeNull();
  });

  it("ignores a hidden password field", () => {
    document.body.innerHTML = `
      <form>
        <input type="password" id="hidden-pw" style="display: none" />
      </form>
    `;
    expect(findLoginForm(document)).toBeNull();
  });

  it("prefers the current-password field over new/confirm fields on a change-password form", () => {
    document.body.innerHTML = `
      <form>
        <input type="password" name="current_password" id="current" autocomplete="current-password" />
        <input type="password" name="new_password" id="new" autocomplete="new-password" />
        <input type="password" name="confirm_password" id="confirm" />
      </form>
    `;
    const detected = findLoginForm(document);
    expect(detected?.passwordInput.id).toBe("current");
  });

  it("falls back to the first password field when every field looks like a new-password field", () => {
    document.body.innerHTML = `
      <form>
        <input type="password" name="new_password" id="new" autocomplete="new-password" />
        <input type="password" name="confirm_password" id="confirm" />
      </form>
    `;
    const detected = findLoginForm(document);
    expect(detected?.passwordInput.id).toBe("new");
  });
});

describe("fillLoginForm", () => {
  it("sets the username and password input values", () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="user" />
        <input type="password" id="pw" />
      </form>
    `;
    const detected = findLoginForm(document)!;
    fillLoginForm(detected, "octocat", "hunter2");
    expect((document.getElementById("user") as HTMLInputElement).value).toBe("octocat");
    expect((document.getElementById("pw") as HTMLInputElement).value).toBe("hunter2");
  });

  it("fills only the password field when there is no username field", () => {
    document.body.innerHTML = `<form><input type="password" id="pw" /></form>`;
    const detected = findLoginForm(document)!;
    fillLoginForm(detected, "octocat", "hunter2");
    expect((document.getElementById("pw") as HTMLInputElement).value).toBe("hunter2");
  });
});
