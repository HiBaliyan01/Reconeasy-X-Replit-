
import { NavLink } from "react-router-dom";
import { AiOutlineDashboard, AiOutlineSetting } from "react-icons/ai";
import { FaRobot, FaFileInvoice, FaUndoAlt } from "react-icons/fa";
import { MdSupportAgent } from "react-icons/md";
import { BiSolidReport } from "react-icons/bi";
import { IoIosListBox } from "react-icons/io";
import { HiOutlineTicket } from "react-icons/hi";
import { PiProjectorScreenChartBold } from "react-icons/pi";
import { TbArrowsExchange } from "react-icons/tb";

const Sidebar = () => {
  return (
    <aside className="w-64 bg-white shadow-md text-sm">
      <div className="p-4 font-bold text-green-600 text-xl border-b">ReconEasy</div>
      <nav className="p-2">
        <NavLink to="/dashboard" className="block p-2 rounded hover:bg-green-100">
          <AiOutlineDashboard className="inline-block mr-2" /> Dashboard
        </NavLink>
        <NavLink to="/ai-insights" className="block p-2 rounded hover:bg-green-100">
          <FaRobot className="inline-block mr-2" /> AI Insights
        </NavLink>
        <div className="text-gray-500 mt-4 mb-1 px-2 uppercase text-xs">Reconciliation</div>
        <NavLink to="/reconciliation/payments" className="block p-2 pl-6 rounded hover:bg-green-100">
          <FaFileInvoice className="inline-block mr-2" /> Payments
        </NavLink>
        <NavLink to="/reconciliation/returns" className="block p-2 pl-6 rounded hover:bg-green-100">
          <FaUndoAlt className="inline-block mr-2" /> Returns
        </NavLink>
        <NavLink to="/reconciliation/settlements" className="block p-2 pl-6 rounded hover:bg-green-100">
          <BiSolidReport className="inline-block mr-2" /> Settlements
        </NavLink>
        <NavLink to="/reconciliation/projected-income" className="block p-2 pl-6 rounded hover:bg-green-100">
          <PiProjectorScreenChartBold className="inline-block mr-2" /> Projected Income
        </NavLink>
        <NavLink to="/rate-cards" className="block p-2 rounded hover:bg-green-100">
          <IoIosListBox className="inline-block mr-2" /> Rate Cards
        </NavLink>
        <NavLink to="/tickets" className="block p-2 rounded hover:bg-green-100">
          <HiOutlineTicket className="inline-block mr-2" /> Tickets
        </NavLink>
        <NavLink to="/settings" className="block p-2 rounded hover:bg-green-100">
          <AiOutlineSetting className="inline-block mr-2" /> Settings
        </NavLink>
        <NavLink to="/support" className="block p-2 rounded hover:bg-green-100">
          <MdSupportAgent className="inline-block mr-2" /> Support
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
