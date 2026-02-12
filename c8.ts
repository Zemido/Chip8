class Surface {
    #pixels: Uint8Array;
    readonly width: number;
    readonly height: number;
    useBuffer: boolean;
    #buffer: Uint8Array;

    constructor(width: number, height: number, data?: number[] | Uint8Array) {
        this.#pixels = new Uint8Array(width * height);
        this.width = width;
        this.height = height;
        this.useBuffer = false;
        this.#buffer = new Uint8Array(width * height);

        if(data) {
            this.#pixels = Uint8Array.from(Array.from(data).concat(Array.from(this.#pixels.slice(data.length))));
        }
    }

    clear(): void {
        this.#pixels = new Uint8Array(this.width * this.height);
    }

    getPixels(): Uint8Array {
        return this.#pixels;
    }

    getPixel(x: number, y: number): number {
        return this.#pixels[(y%this.height)*this.width + (x%this.width)];
    }

    xorPixel(x: number, y: number, val: number): boolean {
        this.#pixels[(y%this.height)*this.width + (x%this.width)] ^= val;
        return (this.#pixels[(y%this.height)*this.width + (x%this.width)] === 0 && val !== 0);
    }

    draw(x: number, y: number, sprite: Surface): boolean {
        let collision = false;
        for(let j=0; j<sprite.height; j++) {
            for(let i=0; i<sprite.width; i++) {
                if(this.#pixels[((y+j)%this.height)*this.width + ((x+i)%this.width)] > 0 && sprite.getPixel(i, j) > 0) {
                    collision = true;
                }
                this.#pixels[((y+j)%this.height)*this.width + ((x+i)%this.width)] ^= sprite.getPixel(i, j);
            }
        }
        return collision;
    }

    drawBuffer() {
        this.#buffer = new Uint8Array(this.#pixels);
    }

    scroll(x: number, y: number) {
        x = (x+this.width) % this.width;
        y = (y+this.height) / this.height;
        let newPixels = new Uint8Array(this.#pixels.length);
        for(let j=0; j<this.height; j++) {
            for(let i=0; j<this.width; i++) {
                newPixels[((y+j)%this.height)*this.width + ((x+i)%this.width)] = this.#pixels[j*this.width+i];
            }
        }
        this.#pixels = newPixels;
    }

    toString(): string {
        let out = "";
        for(let i=0; i<this.height; i++) {
            out += this.#pixels.slice(i*this.width, (i+1)*this.width).reduce((acc, val) => acc+val.toString(), "") + "\n";
        }
        return out;
    }

    toImageData(): ImageData {
        let id = new ImageData(this.width, this.height);
        let array = this.useBuffer ? this.#buffer : this.#pixels;
        for(let i=0; i<id.data.length; i+=4) {
            id.data[i] = array[i/4] * 255;
            id.data[i+1] = array[i/4] * 255;
            id.data[i+2] = array[i/4] * 255;
            id.data[i+3] = 255;
        }
        return id;
    }
}

class C8_Screen extends Surface {
    constructor() {
        super(64, 32);
    }
}

class C8_Sprite extends Surface {
    constructor(data: Uint8Array) {
        if(data.length < 1 || data.length > 15) {
            throw new RangeError("Chip8 sprites can be up to 15 pixels high");
        }
        let expandedData = <number[]> new Array();
        data.forEach(val => {
            expandedData = expandedData.concat([val >> 7, (val >> 6) & 1, (val >> 5) & 1, (val >> 4) & 1,
                (val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1]);
        });
        super(8, data.length, expandedData);
    }
}

class SC8_Sprite extends Surface {
    constructor(data: Uint8Array) {
        if(data.length !== 32) {
            throw new RangeError("SChip8 sprites can only be 16x16 pixels");
        }
        let expandedData = <number[]> new Array();
        for(let i = 0; i<16; i++) {
            let [b1, b2] = [data[i], data[i+1]];
            expandedData = expandedData.concat([b1 >> 7, (b1 >> 6) & 1, (b1 >> 5) & 1, (b1 >> 4) & 1,
                (b1 >> 3 )& 1, (b1 >> 2) & 1, (b1 >> 1) & 1, b1 & 1,
                b2 >> 7, (b2 >> 6) & 1, (b2 >> 5) & 1, (b2 >> 4) & 1,
                (b2 >> 3 )& 1, (b2 >> 2) & 1, (b2 >> 1) & 1, b2 & 1]);
        }
        super(16, 16, expandedData);
    }
}

interface Entry {
    addr: number;
    vx: number;
    vy: number;
    byte: number;
    nibble: number;
}

class C8_CPU {
    protected RAM: Uint8Array;
    protected V: Uint8Array;
    protected _I: Uint16Array;
    protected _DT: Uint8Array;
    protected _ST: Uint8Array;
    protected _PC: Uint16Array;
    protected _SP: Uint8Array;
    protected stack: Uint16Array;
    readonly screen: C8_Screen;
    
    public cbRefresh60: Function;
    public cbKeyboard: Function;
    public cbPlaySound: Function;
    public cbStopSound: Function;
    protected cbSYS: Function[];
    protected handle60?: number;
    protected handleStep?: number;

    constructor(cbRefresh60: Function, cbKeyboard: Function, cbPlaySound: Function, cbStopSound: Function, program?: Uint8Array | number[] | string) {
        this.V = new Uint8Array(16);
        this._I = new Uint16Array(1);
        this._DT = new Uint8Array(1);
        this._ST = new Uint8Array(1);
        this._PC = new Uint16Array(1);
        this._SP = new Uint8Array(1);
        this.stack = new Uint16Array(16);
        this.screen = new C8_Screen();

        this.cbRefresh60 = cbRefresh60;
        this.cbKeyboard = cbKeyboard;
        this.cbPlaySound = cbPlaySound;
        this.cbStopSound = cbStopSound;
        this.cbSYS = [];

        /** Set up RAM */
        this.RAM = new Uint8Array(c8_font.concat(Array.from(new Uint8Array(432))));
        this.load(program ? program : []);
    }

    load(program: number[] | Uint8Array | string) {
        if(typeof program === "string") {
            program = program.replace(/[^0-9A-Fa-f]/g, "");
            let tmp = <number[]> [];
            for(let i=0; i<program.length; i+=2) {
                tmp.push(parseInt(program[i]+program[i+1], 16));
            }
            program = tmp;
        }
        this.RAM = new Uint8Array(Array.from(this.RAM.slice(0,0x200)).concat(
            Array.from(program).concat(Array.from(new Uint8Array(3584 - program.length)))));
        this.PC = 0x200;
    }

    /** Accessors for byte and word values */
    protected get I() {
        return this._I[0];
    }
    protected set I(val: number) {
        this._I[0] = val;
    }

    protected get DT() {
        return this._DT[0];
    }
    protected set DT(val: number) {
        this._DT[0] = val;
    }

    protected get ST() {
        return this._ST[0];
    }
    protected set ST(val: number) {
        this._ST[0] = val;
    }

    protected get PC() {
        return this._PC[0];
    }
    protected set PC(val: number) {
        this._PC[0] = val;
    }

    protected get SP() {
        return this._SP[0];
    }
    protected set SP(val: number) {
        this._SP[0] = val;
    }

    public getV(i: number) {
        return this.V[i];
    }
    public getStack(i: number) {
        return this.stack[i];
    }
    public getI() {
        return this.I;
    }
    public getDT() {
        return this.DT;
    }
    public getST() {
        return this.ST;
    }
    public getPC() {
        return this.PC;
    }
    public getSP() {
        return this.SP;
    }
    public getRAMSprite() {
        return new C8_Sprite(this.RAM.slice(this.I, this.I+15));
    }
    public getOP() {
        return this.RAM[this.PC]*256 + this.RAM[this.PC+1];
    }

    /** loop functions */
    refresh60() {
        if(this.DT > 0) {
            this.DT--;
        }
        if(this.ST > 0) {
            this.ST--;
        }
        if(this.ST === 0) {
            this.cbStopSound();
        }
        this.cbRefresh60();
        this.handle60 = requestAnimationFrame(() => this.refresh60());
    }

    step() {
        let opcode = this.RAM[this.PC] * 0x100 + this.RAM[this.PC+1];
        if(opcode === 0) {
            return;
        }
        const [addr,x,y,byte,nibble] = [opcode & 0xfff,(opcode>>8) & 0xf,(opcode>>4) & 0xf,opcode & 0xff,opcode & 0xf];

        switch(opcode >> 12) {
            case 0:
                switch(addr) {
                    // 00E0: Clear screen. All pixels are set to black
                    case 0xe0: this.screen.clear();
                        break;
                    // 00EE: Subroutine return
                    case 0xee: this.PC = this.stack[--this.SP];
                        break;
                    // 0nnn: Special routine opcode, usually unused
                    default: this.cbSYS[addr]();
                }
                break;
            // 1nnn: Set PC to addr
            case 1: this.PC = (addr & 0xfff) - 2;
                break;
            // 2nnn: Subroutine call
            case 2: this.stack[this.SP++] = this.PC;
                this.PC = (addr & 0xfff) - 2;
                break;
            // 3xkk: Skip next instruction if VX = byte
            case 3: if(this.V[x] === byte) this.PC += 2;
                break;
            // 4xkk: Skip next instruction if VX != byte
            case 4: if(this.V[x] !== byte) this.PC += 2;
                break;
            // 5xy0: Skip next instruction if VX = VY
            case 5:
                if(nibble === 0) {
                    if(this.V[x] === this.V[y]) this.PC += 2;
                }
                break;
            // 6xkk: Set VX = byte
            case 6: this.V[x] = byte;
                break;
            // 7xkk: Set VX = Vx+byte
            case 7: this.V[x] += byte;
                break;
            case 8:
                let borrow: boolean;
                switch(nibble) {
                    // 8xy0: Set VX = VY
                    case 0: this.V[x] = this.V[y];
                        break;
                    // 8xy1: Set VX = VX | VY
                    case 1: this.V[x] |= this.V[y];
                        break;
                    // 8xy2: Set VX = VX & VY
                    case 2: this.V[x] &= this.V[y];
                        break;
                    // 8xy3: Set VX = VX ^ VY
                    case 3: this.V[x] ^= this.V[y];
                        break;
                    // 8xy4: Set VX = VX + VY, VF = carry
                    case 4:
                        this.V[x] += this.V[y];
                        this.V[0xf] = this.V[x] < this.V[y] ? 1 : 0;
                        break;
                    // 8xy5: Set VX = VX - VY, VF = NOT borrow
                    case 5:
                        borrow = this.V[x] < this.V[y];
                        this.V[x] -= this.V[y];
                        this.V[0xf] = borrow ? 0 : 1;
                        break;
                    // 8xy6: Set VX = VY >> 1, VF = LSB VY
                    case 6:
                        this.V[0xf] = this.V[y] & 1;
                        this.V[y] >>= 1;
                        this.V[x] = this.V[y];
                        break;
                    // 0xy7: Set VX = VY - VX, VF = NOT borrow
                    case 7:
                        borrow = this.V[y] < this.V[x];
                        this.V[x] = this.V[y] - this.V[x];
                        this.V[0xf] = borrow ? 0 : 1;
                        break;
                    // 8xyE: Set VX = VY << 1, VF = MSB VY
                    case 0xe:
                        this.V[0xf] = this.V[y] >> 7;
                        this.V[y] <<= 1;
                        this.V[x] = this.V[y];
                        break;
                }
                break;
            // 9xy0: Skip next instruction if VX != VY
            case 9:
                if(nibble === 0) {
                    if(this.V[x] !== this.V[y]) this.PC += 2;
                }
                break;
            // Annn: Set I = addr
            case 0xa: this.I = addr;
                break;
            // Bnnn: Set PV = V0 + addr
            case 0xb: this.PC = this.V[0] + addr - 2;
                break;
            // Cxkk: Set VX = random[0,255] & byte
            case 0xc: this.V[x] = (Math.random()*255) & (byte);
                break;
            // Dxyn: Draw sprite at RAM[I] to RAM[i+nibble] on screen at (VX,VY). Set VF = collision
            case 0xd: this.V[0xf] = this.screen.draw(this.V[x],this.V[y],new C8_Sprite(this.RAM.slice(this.I,this.I+nibble))) ? 1 : 0;
                break;
            case 0xe:
                switch(byte) {
                    // Ex9E: Skip next instruction if KEY = VX
                    case 0x9e: if(this.cbKeyboard() === this.V[x]) this.PC += 2;
                        break;
                    // ExA1: Skip next instruction if KEY != VX
                    case 0xa1: if(this.cbKeyboard() !== this.V[x]) this.PC += 2;
                        break;
                }
                break;
            case 0xf:
                switch(byte) {
                    // Fx07: Set VX = DT
                    case 0x07: this.V[x] = this.DT;
                        break;
                    // Fx0A: Wait for key press, set VX = KEY
                    case 0x0a:
                        let k = this.cbKeyboard();
                        if(k !== undefined) this.V[x] = k;
                        else this.PC -= 2;
                        break;
                    // Fx15: Set DT = VX
                    case 0x15: this.DT = this.V[x];
                        break;
                    // Fx18: Set ST = VX
                    case 0x18:
                        this.ST = this.V[x];
                        if(this.ST > 0) this.cbPlaySound();
                        break;
                    // Fx1E: Set I = I + VX
                    case 0x1e: this.I += this.V[x];
                        break;
                    // Fx29: Set I = sprite(VX)
                    case 0x29: this.I = 5 * this.V[x];
                        break;
                    // Fx33: Set RAM[I], RAM[I+1], RAM[I+2] = BCD(VX)
                    case 0x33:
                        this.RAM[this.I] = this.V[x] / 100;
                        this.RAM[this.I+1] = (this.V[x]/10) % 10;
                        this.RAM[this.I+2] = this.V[x] % 10;
                        break;
                    // Fx55: Set RAM[I .. I+X] = V0 .. VX
                    case 0x55: for(let i=0; i<=x; i++,this.I++) this.RAM[this.I] = this.V[i];
                        break;
                    // Fx65: Set V0 .. VX = RAM[I .. I+X]
                    case 0x65: for(let i=0; i<=x; i++,this.I++) this.V[i] = this.RAM[this.I];
                        break;
                }
                break;
            }
        this.PC += 2;

        this.cbKeyboard();
        this.handleStep = window.setTimeout(() => this.step(), 0);
    }

    reset() {
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60 ?? -1);
        this.PC = 0x200;
        this.I = 0;
        this.V.fill(0);
        this.SP = 0;
        this.stack.fill(0);
        this.DT = 0;
        this.ST = 0;
        this.screen.clear();
    }

    start() {
        this.reset();
        this.refresh60();
        this.step();
    }

    pause() {
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60 ?? -1);
    }

    resume() {
        this.refresh60();
        this.step();
    }

    trueStep() {
        this.refresh60();
        this.step();
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60 ?? -1);
    }

    bindCustom(cb: Function, addr: number) {
        if(addr === 0xe0 || addr === 0xee) {
            throw new RangeError("0x00E0 and 0x00EE are reserved existing opcodes")
        }
        if(this.cbSYS[addr]) {
            console.warn(`Overwrite of existing SYS function at 0x${addr.toString(16)}`);
        }
        this.cbSYS[addr] = cb.bind(this);
    }
}

class SC8_CPU extends C8_CPU {
    private R: Uint8Array;

    constructor(cbRefresh60: Function, cbKeyboard: Function, cbPlaySound: Function, cbStopSound: Function, program?: Uint8Array | number[] | string) {
        super(cbRefresh60, cbKeyboard, cbPlaySound, cbStopSound, program);

        this.R = new Uint8Array(8);
    }

    // 00Bn
    // Scroll display n pixels up
    protected SCU_nibble({nibble}: Entry) {
        this.screen.scroll(0, -nibble);
    }

    // 00Cn
    // Scroll display n pixels down
    protected SCD_nibble({nibble}: Entry) {
        this.screen.scroll(0, nibble);
    }

    // 00FB
    // Scroll display 4 pixels right
    protected SCR() {
        this.screen.scroll(4, 0);
    }

    // 00FC
    // Scroll display 4 pixels left
    protected SCL() {
        this.screen.scroll(-4, 0);
    }

    // 00FD
    // Exit the interpreter
    protected EXIT()  {
        this.screen.clear();
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60 ?? -1);
    }

    // 00FE
    // Enable low-res (64x32) mode
    protected LOW() {

    }

    // 00FF
    // Enable high-res (128x64) mode
    protected HIGH() {

    }

    // Dxyn
    // Draw sprite at RAM[I] to RAM[i+nibble] on screen at (vx, vy)
    // When n = 0 and high-res mode is enabled, draw high-res 16x16 sprite
    // Set VF = collision
    protected DRW_vx_vy_nibble({vx, vy, nibble}: Entry) {
        let sprite = (nibble === 0) ?
            new SC8_Sprite(this.RAM.slice(this.I, this.I + 32)) :
            new C8_Sprite(this.RAM.slice(this.I, this.I + nibble));
        
        this.V[0xf] = this.screen.draw(this.V[vx], this.V[vy], sprite) ? 1 : 0;
    }

    // FX30
    // Set I = high-res sprite(VX)
    protected LD_HF_Vx({vx}: Entry) {
        this.I = 80 + 20 * this.V[vx];
    }

    // Fx75
    // Set R flags to values of V0, ...,  VX (X <= 7)
    protected LD_R_VX({vx}: Entry) {
        for(let i=0; i<=vx; i++) {
            this.R[i] = this.V[i];
        }
    }

    // Fx85
    // Set registers V0, ..., VX to values of R flags (X <= 7)
    protected LD_VX_R({vx}: Entry) {
        for(let i=0; i<=vx; i++) {
            this.V[i] = this.R[i];
        }
    }
}

const c8_font = [
    0xf0, 0x90, 0x90, 0x90, 0xf0,
    0x20, 0x60, 0x20, 0x20, 0x70,
    0xf0, 0x10, 0xf0, 0x80, 0xf0,
    0xf0, 0x10, 0xf0, 0x10, 0xf0,
    0x90, 0x90, 0xf0, 0x10, 0x10,
    0xf0, 0x80, 0xf0, 0x10, 0xf0,
    0xf0, 0x80, 0xf0, 0x90, 0xf0,
    0xf0, 0x10, 0x20, 0x40, 0x40,
    0xf0, 0x90, 0xf0, 0x90, 0xf0,
    0xf0, 0x90, 0xf0, 0x10, 0xf0,
    0xf0, 0x90, 0xf0, 0x90, 0x90,
    0xe0, 0x90, 0xe0, 0x90, 0xe0,
    0xf0, 0x80, 0x80, 0x80, 0xf0,
    0xe0, 0x90, 0x90, 0x90, 0xe0,
    0xf0, 0x80, 0xf0, 0x80, 0xf0,
    0xf0, 0x80, 0xf0, 0x80, 0x80,
];

const customFunctions: Function[] = [];