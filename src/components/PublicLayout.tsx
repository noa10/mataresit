import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Navbar />
      <div className="px-0">
        <Outlet />
      </div>
    </div>
  );
}
