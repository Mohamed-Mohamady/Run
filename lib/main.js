"use babel";

import { CompositeDisposable } from "atom";
import child_process from "child_process";

export default {
  subscriptions: null,

  activate() {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "run:compile": () => this.toggle(),
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  toggle() {
    compile();
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
    }
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
  return atom.workspace.getActiveTextEditor().getGrammar().name;
}

/*
 * Function: get_file_path
 * Return path of the current opened file.
 */
function get_file_path() {
  let editor = atom.workspace.getActiveTextEditor();
  // Check if there is even a file opened.
  let buf = editor ? editor.buffer : null;
  if (buf) {
    return buf.file.path;
  } else {
    atom.notifications.addError("Cannot find file");
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
 * args      list of extra arguments and options for the compiler
 */
function get_args(file, output, args = []) {
  return [file, "-o", output, ...args];
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
 * Function: compile
 * Handle the main compilation process routines.
 */
function compile() {
  const lang = get_grammar();
  const file = get_file_path();
  const target = get_compiled_path(file);
  const args = get_args(file, target);
  const cmd = get_command(lang);
  const os = process.platform;

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
        if (os === "win32") {
          child_process.exec(`start cmd /C "${target} & pause"`);
        } else if (os === "linux") {
          // Only Debian-based currently supported
          child_process.spawn("x-terminal-emulator", ["-e", target]);
        }
      }
    }
  });
}
