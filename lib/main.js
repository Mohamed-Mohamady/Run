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
  },
};

/*
 * Function: get_grammar
 * Return current opened file grammar (language mode)
 * we let atom handle various extensions for the same
 * language routine for us but in the future this will
 * be replace with much advanced function that detects
 * language even if it's specified in atom grammar list.
 */
function get_grammar() {
  return atom.workspace.getActiveTextEditor().getGrammar().name;
}

// Return path object from current opened file path.
function get_file_path() {
  let editor = atom.workspace.getActiveTextEditor();
  // Check if there is even a file opened.
  let buf = editor ? editor.buffer : null;
  if (buf) {
    return buf.file.path;
  } else {
    atom.notifications.addError("File Not Found");
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
      return cmd;
    case "C++":
      return atom.config.get("run.cpp_compiler");
  }
}

/*
 * Function: compile
 * Handle the main compilation process routines.
 */
function compile() {
  const lang = get_grammar();
  const file = get_file_path();
  const outPath = get_compiled_path(file);
  const args = get_args(file, outPath);
  const cmd = get_command(lang);

  child_process.spawn(cmd, args);

  if (atom.config.get("run.run_after_compile")) {
    child_process.exec(`start ${outPath}`);
  }
}
