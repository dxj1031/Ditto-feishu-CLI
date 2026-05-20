Node runtime placeholder

To include a Node runtime for macOS, place a portable Node distribution under:

  runtime/node/bin/node

For example, on macOS you can download a Node binary and place its 'bin/node' here.

If you don't include a runtime, the launcher will use the system 'node' if available.
