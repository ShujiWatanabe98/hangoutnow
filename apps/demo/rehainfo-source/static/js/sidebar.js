"use strict";
{
  var handleExpandSidebar = () => {
    const sidebar = document.querySelector(".sidebar");
    const toggleButton = document.querySelector(".sidebar-toggle");
    const isExpanded = localStorage.getItem("sidebarExpanded");
    if (isExpanded == "true") {
      sidebar.classList.add("expanded");
      toggleButton.title = "メニューを折りたたむ";
    } else {
      sidebar.classList.remove("expanded");
      toggleButton.title = "メニューを展開する";
    }
    handleWidthOfContent();
  };

  var handleWidthOfContent = () => {
    const listClass = [
      "dashboard-container",
      "evaluation-plan-container",
      "treatment-plan-container",
      "treatment-implement-container",
      "admin-evaluation-preset-container",
      "admin-treatment-preset-container",
      "sub-doctor-schedule-container",
      "soap-list-container",
    ];
    listClass.forEach((className) => {
      const element = document.querySelector(`.${className}`);
      const sidebar = document.querySelector(".sidebar");
      if (element && sidebar) {
        element.style.transition = "width 0.1s ease";
        element.style.width = sidebar.classList.contains("expanded")
          ? "calc(100% - 230px)"
          : "calc(100% - 60px)";
      }
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.querySelector(".sidebar");
    const toggleButton = document.querySelector(".sidebar-toggle");

    if (toggleButton && sidebar) {
      // Set initial state - default is collapsed (no class needed)
      toggleButton.title = "メニューを展開する";

      toggleButton.addEventListener("click", function () {
        sidebar.classList.toggle("expanded");

        const isExpanded = sidebar.classList.contains("expanded");
        localStorage.setItem("sidebarExpanded", isExpanded);

        // Update toggle button title
        toggleButton.title = isExpanded
          ? "メニューを折りたたむ"
          : "メニューを展開する";
        sidebarState = isExpanded ? "expanded" : "collapsed";
        handleWidthOfContent();
      });

      // Restore saved state
      if (sidebarState === "expanded") {
        sidebar.classList.add("expanded");
        toggleButton.title = "メニューを折りたたむ";
      } else {
        // Ensure collapsed state
        sidebar.classList.remove("expanded");
        toggleButton.title = "メニューを展開する";
      }
      const isExpanded = localStorage.getItem("sidebarExpanded");
      if (isExpanded == "true") {
        toggleButton.click();
      }
      handleWidthOfContent();
    }
  });
}
