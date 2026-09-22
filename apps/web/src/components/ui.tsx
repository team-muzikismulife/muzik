import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router";
import { MoreHorizontal, X } from "lucide-react";
import { CommandError } from "../../../../packages/domain/index";
import s from "../App.module.css";

export class Boundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <State title="화면을 불러오지 못했어요">
        <a className={s.secondary} href="/">
          처음으로
        </a>
      </State>
    ) : (
      this.props.children
    );
  }
}
export function State({
  title = "잠시만 기다려 주세요",
  children,
  page = false,
}: {
  title?: string;
  children?: ReactNode;
  page?: boolean;
}) {
  const Heading = page ? "h1" : "h2";
  return (
    <section className={s.state} aria-live="polite">
      <Heading>{title}</Heading>
      {children}
    </section>
  );
}
export function Invalid() {
  return (
    <section className={s.state}>
      <h1>링크를 확인해 주세요</h1>
      <p>팀 또는 날짜 정보가 올바르지 않아요.</p>
      <Link className={s.secondary} to="/">
        팀 목록으로
      </Link>
    </section>
  );
}
export function ErrorText({ error }: { error: Error | null }) {
  const location = useLocation();
  if (!error) return null;
  return (
    <div className={s.error} role="alert">
      <p>{error.message}</p>
      {error instanceof CommandError && error.code === "UNAUTHENTICATED" && (
        <Link
          className={s.secondary}
          to={`/login?reauth=1&next=${encodeURIComponent(location.pathname + location.search)}`}
        >
          초안 보관하고 다시 로그인
        </Link>
      )}
    </div>
  );
}
export function Menu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>("button,a,input")?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const outside = (e: PointerEvent) => {
      if (
        !box.current?.contains(e.target as Node) &&
        !button.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <div className={s.menu}>
      <button
        ref={button}
        className={s.menuTrigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <MoreHorizontal size={18} />
        {label}
      </button>
      {open && (
        <div id={id} ref={box} className={s.menuPanel}>
          {children(close)}
          <button onClick={close}>
            <X size={16} />
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
