interface EditorTabSwitcherProps {
  activeTab: "task" | "notification";
  onTabChange: (tab: "task" | "notification") => void;
}

export const EditorTabSwitcher = ({
  activeTab,
  onTabChange,
}: EditorTabSwitcherProps) => {
  return (
    <div className="flex border-b border-gray-300 dark:border-input">
      <button
        type="button"
        onClick={() => onTabChange("task")}
        className={`px-6 py-3 text-lg font-semibold transition-colors max-md:flex-1 max-md:px-3 max-md:text-base ${
          activeTab === "task"
            ? "border-b-2 border-red-500 text-gray-900 dark:text-white"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        }`}
      >
        Add Task
      </button>
      <button
        type="button"
        onClick={() => onTabChange("notification")}
        className={`px-6 py-3 text-lg font-semibold transition-colors max-md:flex-1 max-md:px-3 max-md:text-base ${
          activeTab === "notification"
            ? "border-b-2 border-red-500 text-gray-900 dark:text-white"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        }`}
      >
        Notification
      </button>
    </div>
  );
};
