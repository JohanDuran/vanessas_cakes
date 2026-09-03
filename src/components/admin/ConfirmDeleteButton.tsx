"use client";

type Props = {
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
};

/** A submit button for a plain server-action delete form that asks for
 *  confirmation first — drop it inside an existing `<form action={...}>`
 *  without converting the surrounding page to a client component. */
export default function ConfirmDeleteButton({
  confirmMessage,
  className = "admin-btn-sm admin-btn-sm--danger",
  children,
}: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
