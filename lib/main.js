"use babel";

import { CompositeDisposable } from "atom";
import child_process from "child_process";
import { platform } from "process";
import path from "path";
import fs from "fs";

export default {
  subscriptions: null,

  activate() {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "run:compile": () => compile(),
        "run:debug": () => compile(true),
        "run:build": () => build()
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  config: get_config()
};

/*
 * Function: get_config
 * Return platform specific extension
 * configurations on start up.
 */
function get_config() {
  // Default configurations for all platforms
  let config = {
    c_compiler: {
      title: "C Compiler",
      description: "Default C language compiler",
      type: "string",
      default: "gcc",
    },
    cpp_compiler: {
      title: "C++ Compiler",
      description: "Default C++ language compiler",
      type: "string",
      default: "g++",
    },
    c_compiler_options: {
      title: "C Compiler Options",
      description: "Extra C compiler options",
      type: "string",
      default: "",
    },
    cpp_compiler_options: {
      title: "C++ Compiler Options",
      description: "Extra C++ compiler options",
      type: "string",
      default: "",
    },
    run_after_compile: {
      title: "Run after compile",
      description: "Run program after compilation process",
      type: "boolean",
      default: true,
    },
    show_warnings: {
      title: "Show warnings",
      description: "Show compiler warnings",
      type: "boolean",
      default: true,
    },
    compile_to_tmpdir: {
      title: "Compile to tmp directory",
      description:
        "The compiled file will be in system temporary directory to keep workspace clean",
      type: "boolean",
      default: true,
    }
  };

  // Add linux platform configurations
  if (platform === "linux") {
    config["linux_terminal"] = {
      title: "Linux terminal",
      description: "The default terminal used to launch targets",
      type: "string",
      enum: [
        "Gnome Terminal", // Default terminal for GNOME
        "Konsole",        // Default terminal for KDE
        "Mate Terminal",  // Default terminal for MATE
        "Xfce Terminal",  // Default terminal for XFCE
        "Xterm",          // The standard terminal emulator
      ],
      default: "Xterm",
    }
  }

  return config;
}

/*
 * Function: tmpdir
 * Get the temporary directory in different platforms.
 */
function tmpdir() {
  if (platform === "win32") {
    return process.env["TEMP"];
  } else {
    return "/tmp";
  }
}

/*
 * Function: get_grammar
 * Return current opened file grammar (language mode)
 * we let atom handle various extensions for the same
 * language routine for us but in the future this will
 * be replace with much advanced function that detects
 * language even if it's not specified in atom grammar list.
 */
function get_grammar() {
  let editor = atom.workspace.getActiveTextEditor();
  // Check if there is even a file opened.
  return editor ? editor.getGrammar().name : null;
}

/*
 * Function: get_file_path
 * Return path of the current opened file.
 */
function get_file_path() {
  // all files in atom are buffers but not true all buffers are files
  let buf = atom.workspace.getActiveTextEditor().buffer;
  let file = buf.file;

  if (file) {
    return file.path;
  } else {
    atom.notifications.addError("Cannot find file");
    return null;
  }
}

/*
 * Function: get_compiled_path
 * Fabricate absolute path for the compiled file
 * out of the current opened source file.
 *
 * Parameters:
 * source    path of current opened file
 */
function get_compiled_path(source) {
  // Get path object from source file path
  let po = path.parse(source);

  // Check if it's configured to put output (compiled) file in tmp dir
  if (atom.config.get("run.compile_to_tmpdir")) {
    return tmpdir() + path.sep + po.name;
  }

  return po.dir + path.sep + po.name;
}

/*
 * Function: get_args
 * Return an array of arguments that will
 * be passed to the compiler.
 *
 * Parameters:
 * file      path of current opened file
 * output    path of the compiled file
 * debug     specify if compilation is for debugging purposes
 * args      list of extra arguments and options for the compiler
 */
function get_args(file, output, debug, args) {
  // return args without any empty element (evaluates to false)
  return [file, "-o", output, debug ? "-g" : "", ...args].filter(Boolean);
}

/*
 * Function: get_command
 * Return the specified compiler with the programming language.
 *
 * Parameters:
 * lang      programming language of the file
 */
function get_command(lang) {
  switch (lang) {
    case "C":
      return atom.config.get("run.c_compiler");
    case "C++":
      return atom.config.get("run.cpp_compiler");
    default:
      return null;
  }
}

/*
 * Function: get_opts
 * Return an array of extra compiler options
 * specified by the user or empty array.
 *
 * Parameters:
 * lang      programming language of the file
 */
function get_opts(lang) {
  let opts = null;

  switch (lang) {
    case "C":
      opts = atom.config.get("run.c_compiler_options");
    case "C++":
      opts = atom.config.get("run.cpp_compiler_options");
  }

  return opts ? opts.split(" ") : [];
}

/*
 * Function: get_terminal
 * Return the terminal command 
 * representing the chosen terminal
 * in extension configurations.
 */
function get_terminal() {
  // Get specified terminal or default one
  let terminal = atom.config.get("run.linux_terminal");

  switch (terminal) {
    case "Gnome Terminal":
      return "gnome-terminal";

    case "Konsole":
      return "konsole";

    case "Mate Terminal":
      return "mate-terminal";

    case "Xfce Terminal":
      return "xfce4-terminal";

    default:
      return "xterm";
  }
}

/*
 * Function: msg
 * Return string that is ready to be embedded in atom notifications.
 *
 * Parameters:
 * str       string to be optimized represents the message
 */
function msg(str) {
  return str.replace(/\n/g, "<br />");
}

/*
 * Function: launch
 * Handle the launch of a program through different
 * circumstances (environments and purposes) routines.
 *
 * Parameters:
 * target    represents the program to launch
 * debug     launch GDB to debug the target or not
 */
function launch(target, debug) {
  if (platform === "win32") {
    if (debug) {
      child_process.exec(`start cmd /C "gdb ${target}"`);
    } else {
      child_process.exec(`start cmd /C "${target} & pause"`);
    }
  } else if (platform === "linux") {
    let terminal = get_terminal();
    child_process.spawn(terminal, [
      "-e",
      debug ? "gdb" : "",
      target,
    ].filter(Boolean));
  }
}

/*
 * Function: compile
 * Handle the main compilation process routines.
 *
 * Parameters:
 * debug     debug the program after compilation
 */
function compile(debug = false) {
  const lang = get_grammar();

  if (!lang) {
    atom.notifications.addError("There is no file opened");
    return;
  }

  const file = get_file_path();

  if (!file) {
    return;
  }

  const target = get_compiled_path(file);
  const cmd = get_command(lang);

  if (!cmd) {
    atom.notifications.addError("Not supported language");
    return;
  }

  const opts = get_opts(lang);
  const args = get_args(file, target, debug, opts);

  const ps = child_process.spawn(cmd, args);

  // Wrap all process stderr output in one place
  let error = "";
  ps.stderr.on("data", (data) => {
    error += data;
  });

  // Check for compilation errors (process exit with code other than 0)
  ps.on("close", (code) => {
    if (code) {
      atom.notifications.addError(msg(error));
    } else {
      // Check for warnings (process exit normally but there's text in stderr)
      if (error && atom.config.get("run.show_warnings")) {
        atom.notifications.addWarning(msg(error));
      }

      if (atom.config.get("run.run_after_compile")) {
        launch(target, debug);
      } else {
        atom.notifications.addSuccess("File compiled successfully");
      }
    }
  });
}

/*
 * Current project to build that has 
 * been chosen by the user from multiple
 * projects or if there is only one
 * project opened in the workspace
 * so logically it is the one. 
 */
let current_project = null;

/*
 * Function: get_current_project
 * Return the current project value. 
 */
function get_current_project() {
  return current_project;
}

/*
 * Function: set_default_project
 * Update the current project
 * with the new given value.
 * 
 * Parameters:
 * project   the new value of the current project 
 */
function set_current_project(project) {
  current_project = project;
}

/*
 * Function: get_projects
 * Return array of active projects
 * in the current workspace.
 */
function get_projects() {
  return atom.project.getPaths();
}

/*
 * Function: show_projects
 * Show notification contains current
 * active projects in the workspace
 * to choose one of them to build.
 *
 * Parameters:
 * projects  array of projects to show
 */
async function show_projects(projects) {
  return new Promise((resolve) => {
    const notify = atom.notifications.addInfo("Choose project to build", {
      description:
        "You have multiple projects in the same workspace " +
        "choose one of the given projects to build.",
      dismissable: true,
      buttons: projects.map(function (project) {
        let name = path.parse(project).name;
        return {
          text: `Build ${name}`,
          onDidClick: () => {
            set_current_project(project);
            notify.dismiss();
            resolve(true);
          },
        }
      })
    })  
  })
}

/*
 * Function: has_command
 * Check if system has the
 * specified command installed 
 * and it is ready to work.
 * 
 * Parameters:
 * command   command to check for existence
 */
function has_command(command = "") {
  if (!command) {
    return false;
  }

  try {
    child_process.execSync(`${command} --version`);
  } catch (e) {
    console.error(e);
    return false;
  }

  return true;
}

/*
 * Function: has_makefile
 * Check if a makefile exists in a given path.
 * 
 * Parameters:
 * path      path to search for Makefile in
 */
function has_makefile(path = "") {
  try {
    let files = fs.readdirSync(path);
    return files.includes("Makefile") ? true : false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

/*
 * Function: get_make_command
 * Return platform specific make command
 * in windows make is available through Mingw
 * and its name is derived but in other platforms 
 * you can call it by its original name. 
 */
function get_make_command() {
  return platform === "win32" ? " mingw32-make.exe" : "make";
}

/*
 * Function: build
 * Build current active project
 * with make build tool.
 * 
 * Parameters:
 * target    target to build
 */
async function build(target = "") {
  // Get array of current active projects in the workspace 
  const projects = get_projects();

  // Check if there is multiple projects in the same workspace
  if (projects.length > 1) {
    // Wait for user to choose project to build
    await show_projects(projects);
  } else {
    // There is an active project or no projects at all
    if (projects[0]) {
      // One active project so logically it is the one
      set_current_project(projects[0]);
    } else {
      // No projects in the current workspace
      console.log("There is no projects to build in the current workspace"); 
      return;
    }
  }

  let project = get_current_project();

  // Check for makefile in the project
  if (!has_makefile(project)) {
    console.log("Makefile not found");
    return;
  }

  let make = get_make_command();
  let cmd = make + " " + target;
  let options = {
    cwd: project,
  };

  // Check if the machine has make installed
  if (!has_command(make)) {
    console.log("Make command not found");
    return;
  }
 
  const ps = child_process.exec(cmd, options);

  // Wait for the process to finish
  ps.on("close", (code) => {
    // Check if process exited with error
    if (code) {
      console.log("Error");
    } else {
      console.log("Success");
    }
  });
}
