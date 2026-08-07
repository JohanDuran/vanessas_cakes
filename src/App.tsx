import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Customize from "./pages/Customize";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/customize" element={<Customize />} />
    </Routes>
  );
}

export default App;
