import { Outlet, } from "react-router-dom";

import Header from "../Header";

export default function Layout() {
 

  return (
   <>
     <Header/>
      <main className="pt-16 p-6 bg-gray-50 min-h-screen">
        <Outlet />
      </main>
    </>
  );
}
