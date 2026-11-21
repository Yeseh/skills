# Detail levels

All three levels share the same structure (see `note-templates.md`). The levels change how much help each part gives. No level gives the solution code.

The example topic below is Part 03 (filesystem isolation) of the Zandbox guide (an agent sandbox in Zig).

## Light

For topics that the user knows well. The user needs a map and a checklist, not a teacher.

Each part contains:
- Goal (one sentence)
- Why (2–4 sentences)
- What to build (numbered steps: what, not how)
- Read up on (names of man pages, specs, std modules)
- Done when (checkboxes)
- Traps (2–4)

Example step:
> **Stop mount propagation.** Recursively mark the whole tree private first. If you do not, your mounts can propagate back to the host.

## Medium

For topics that are new to the user. This is the level to recommend when the user says "I am not familiar with this". The user knows how to program, but does not know the domain words, the mechanisms, or where to start.

Each part contains everything in Light, plus:
- **Concepts** section before "What to build". Explain each new mechanism in 2–5 sentences: what it is, what problem it solves, and how it connects to the previous part. Define each term of art when you use it the first time.
- **Named techniques and APIs** in each step. Give the name of the syscall, function, flag, or algorithm that does the job. Do not show how to call it.
- **"Start here" hint** in a step when there are many possible approaches. Name the simplest approach that works and say why.
- **Inline links** in the steps, to the exact section of the documentation where possible.
- **"Try it by hand first"** tip when a command-line tool can show the effect before the user writes code.

Example step:
> **Stop mount propagation.** On most systemd distributions, mounts are *shared* by default. A shared mount copies new mounts to its peers, and the host is one of the peers. Mark the full tree as *private* and *recursive* with `mount(2)` ([man7.org: mount(2)](https://man7.org/linux/man-pages/man2/mount.2.html)). Read "shared subtrees" in [mount_namespaces(7)](https://man7.org/linux/man-pages/man7/mount_namespaces.7.html) to understand the four propagation types.
> *Try it by hand first:* run `unshare -m --propagation private bash`, then mount a tmpfs, then run `findmnt` on the host.

## Heavy

For topics that are very new or very hard (for example: kernel interfaces, compilers, cryptography, concurrency). The user needs help to design the code, but must still write it.

Each part contains everything in Medium, plus:
- **Step outline** for difficult steps: the sequence of operations in plain words or in short pseudocode. Pseudocode must not be valid code in the target language.
- **Shapes**: the fields of the main data structures and the signatures of the main functions, in pseudocode or as a table. Do not write the bodies.
- **Check your design** question at the end of each part. The question makes the user find the most common design error before it causes a bug (for example: "Which process writes the uid_map, and why can the child not do it?").
- **Debugging tips**: the error the user will most probably see, and what it usually means.

Example step:
> **Stop mount propagation.** (Medium text, then:)
> Outline: `mount(source=none, target="/", fstype=none, flags=REC|PRIVATE, data=none)` → check the result → continue only if the result is success.
> If you see `EINVAL`: you are probably not in a new mount namespace yet.
