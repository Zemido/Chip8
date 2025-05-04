# Chip8
This is a Chip8 emulator written in Javascript, an example minigame is provided as PoC.
The overall behavior follows descriptions from [Cowgod's techical reference](http://devernay.free.fr/hacks/chip8/C8TECH10.HTM).
The bomber minigame is written in a homemade dialect with some syntactic sugar to help with the editing of new programs, it is explained below. The program is first translated into a regular binary before being fed to the emulator.

You can try the Bomber minigame directly [here](https://zemido.github.io/Chip8/c8.html).
The 'A' key the game uses is in fact the 'Z' on your regular keyboard, see next section on the keys layout. Touching the screen will also work on smartphone.

## Keys layout
The usual Chip8 Keys layout is like this:
_ | _ | _ | _ 
--- | --- | --- | ---
1 | 2 | 3 | C
4 | 5 | 6 | D
7 | 8 | 9 | E
A | 0 | B | F

Here the emulator uses the same layout, using the keys from the left side of the keyboard:
_ | _ | _ | _ 
--- | --- | --- | ---
1 | 2 | 3 | 4
Q | W | E | R
A | S | D | F
Z | X | C | V

The emulator is locale agnostic, so it should work with any keyboard layout.

## Other controls
* Start: Starts the emulator. Clinking again on the button resets the program.
* Pause/Resume: Pause or resume the execution.
* Step: When the emulator is paused, clinking this executes only the current instruction.
* Toggle debug: Display the debug panel, which shows the contents of registers, stack, and the sprite representation of memory.
* Sound: Toggles the buzzer.

## Homemade dialect
No custom instruction is used: as is, all the dialect does is making the code readable, with some syntactic sugar:
* Comments start with ';'.
* Constants start with '$'. If it is followed by a number, sets the constant to this number.
* Labels end with ':'. They are both code labels and a memory address.
* Gotos start with '@'. They work with the labels.
* Litteral hexadecimal start with '#'. It is used to put litteral binary data inside the code, and can be used to put sprites or buffer zones.
* Multiple instructions can be on the same line, they just need to be separated by a '|'.
You can check the content of [bomber.js](https://zemido.github.io/Chip8/bomber.js) to check how this is used.
