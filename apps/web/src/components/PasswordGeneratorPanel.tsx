import { useEffect, useState } from "react";
import { defaultGeneratorRules, generatePasswordAsync, type GeneratorRules } from "@vault/core";

interface Props {
  initialRules?: GeneratorRules;
  onUse?: (password: string) => void;
}

export default function PasswordGeneratorPanel({ initialRules, onUse }: Props) {
  const [rules, setRules] = useState<GeneratorRules>(initialRules ?? defaultGeneratorRules());
  const [password, setPassword] = useState("");

  async function regenerate(nextRules: GeneratorRules) {
    setPassword(await generatePasswordAsync(nextRules));
  }

  useEffect(() => {
    regenerate(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRules(patch: Partial<GeneratorRules>) {
    const next = { ...rules, ...patch };
    setRules(next);
    regenerate(next);
  }

  return (
    <div>
      <div className="field">
        <input readOnly value={password} style={{ fontFamily: "ui-monospace, monospace" }} />
      </div>
      <div className="field">
        <label>Length: {rules.length}</label>
        <input
          type="range"
          min={8}
          max={64}
          value={rules.length}
          onChange={(e) => updateRules({ length: Number(e.target.value) })}
        />
      </div>
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="gen-upper"
          checked={rules.useUpper}
          onChange={(e) => updateRules({ useUpper: e.target.checked })}
        />
        <label htmlFor="gen-upper">Uppercase (A-Z)</label>
      </div>
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="gen-lower"
          checked={rules.useLower}
          onChange={(e) => updateRules({ useLower: e.target.checked })}
        />
        <label htmlFor="gen-lower">Lowercase (a-z)</label>
      </div>
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="gen-digits"
          checked={rules.useDigits}
          onChange={(e) => updateRules({ useDigits: e.target.checked })}
        />
        <label htmlFor="gen-digits">Digits (0-9)</label>
      </div>
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="gen-symbols"
          checked={rules.useSymbols}
          onChange={(e) => updateRules({ useSymbols: e.target.checked })}
        />
        <label htmlFor="gen-symbols">Symbols (!@#…)</label>
      </div>
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="gen-ambiguous"
          checked={rules.excludeAmbiguous}
          onChange={(e) => updateRules({ excludeAmbiguous: e.target.checked })}
        />
        <label htmlFor="gen-ambiguous">Exclude ambiguous characters (l, 1, O, 0…)</label>
      </div>
      <div className="row">
        <button className="secondary" onClick={() => regenerate(rules)}>
          Regenerate
        </button>
        <button className="secondary" onClick={() => navigator.clipboard.writeText(password)}>
          Copy
        </button>
        {onUse && (
          <button
            onClick={() => {
              onUse(password);
            }}
          >
            Use this password
          </button>
        )}
      </div>
    </div>
  );
}
