"use babel";

import { CompositeDisposable } from "atom";
import child_process from "child_process";
import { platform } from "process";

export default {
  subscriptions: null,

  activate() {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "run:compile": () => compile(),
        "run:debug": () => compile(true),
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  config: {
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
  },
};

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
 * out of the current opened file.
 *
 * Parameters:
 * path      path of current opened file
 */
function get_compiled_path(path) {
  return path.substring(0, path.lastIndexOf("."));
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
 * circumstances (environments and purposes) routines
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
    // Only Debian-based currently supported
    child_process.spawn("x-terminal-emulator", [
      "-e",
      debug ? "gdb" : "",
      target,
    ]);
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
      }
    }
  });
}
