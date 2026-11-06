import { useState } from "react";

// A password field with a Show / Hide button.
export default function PasswordInput({ value, onChange, ...rest }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="pw">
      <input type={shown ? "text" : "password"} value={value} onChange={onChange} {...rest} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}
