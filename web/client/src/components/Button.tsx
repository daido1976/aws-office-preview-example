import React from "react";

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}
export const Button: React.FC<ButtonProps> = ({ onClick, children }) => {
  return (
    <button onClick={onClick} className="button">
      {children}
    </button>
  );
};
