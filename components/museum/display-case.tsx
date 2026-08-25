import type { ReactNode } from "react";
import s from "./museum.module.css";

/**
 * The vitrine. Everything interactive in this museum sits inside one, so a
 * visitor can always tell what is an object and what is a wall label.
 */
export function DisplayCase({
  label,
  aside,
  note,
  children,
}: {
  label: string;
  aside?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.case}>
      <div className={s.caseHead}>
        <span className="label">{label}</span>
        {aside}
      </div>
      <div className={s.caseBody}>{children}</div>
      {note ? <p className={s.caseNote}>{note}</p> : null}
    </div>
  );
}
