class Surface {
    #pixels: Uint8Array;
    readonly width: number;
    readonly height: number;

    constructor(width: number, height: number, data?: number[] | Uint8Array) {
        this.#pixels = new Uint8Array(width * height);
        this.width = width;
        this.height = height;

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
        for(let i=0; i<id.data.length; i+=4) {
            id.data[i] = this.#pixels[i/4] * 255;
            id.data[i+1] = this.#pixels[i/4] * 255;
            id.data[i+2] = this.#pixels[i/4] * 255;
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
    protected opcodes: Function[];

    public cbRefresh60: Function;
    public cbKeyboard: Function;
    public cbPlaySound: Function;
    public cbStopSound: Function;
    protected handle60: number;
    protected handleStep: number;

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

        /** Set up RAM */
        this.RAM = new Uint8Array(c8_font.concat(Array.from(new Uint8Array(432))));
        this.load(program ? program : []);
        
        this.PC = 0x200;

        // Set up opcodes
        this.opcodes = new Array(0x10000).fill(0).map((val, opcode) => {
            switch(opcode >> 12) {
                case 0: return (opcode % 256) === 0xe0 ? this.CLS :
                    (opcode % 256) === 0xee ? this.RET : this.SYS_addr;
                case 1: return this.JP_addr;
                case 2: return this.CALL_addr;
                case 3: return this.SE_vx_byte;
                case 4: return this.SNE_vx_byte;
                case 5: return (opcode % 16) === 0 ? this.SE_vx_vy : this.NOP;
                case 6: return this.LD_vx_byte;
                case 7: return this.ADD_vx_byte;
                case 8: switch(opcode % 16) {
                    case 0:   return this.LD_vx_vy;
                    case 1:   return this.OR_vx_vy;
                    case 2:   return this.AND_vx_vy;
                    case 3:   return this.XOR_vx_vy;
                    case 4:   return this.ADD_vx_vy;
                    case 5:   return this.SUB_vx_vy;
                    case 6:   return this.SHR_vx_vy;
                    case 7:   return this.SUBN_vx_vy;
                    case 0xe: return this.SHL_vx_vy;
                    default:  return this.NOP;
                }
                case 9:   return (opcode % 16) === 0 ? this.SNE_vx_vy : this.NOP;
                case 0xa: return this.LD_i_addr;
                case 0xb: return this.JP_v0_addr;
                case 0xc: return this.RND_vx_byte;
                case 0xd: return this.DRW_vx_vy_nibble;
                case 0xe: return (opcode % 256) === 0x9e ? this.SKP_vx :
                    (opcode % 256) === 0xa1 ? this.SKNP_vx : this.NOP;
                case 0xf: switch(opcode % 256) {
                    case 0x7:  return this.LD_vx_dt;
                    case 0xa:  return this.LD_vx_k;
                    case 0x15: return this.LD_dt_vx;
                    case 0x18: return this.LD_st_vx;
                    case 0x1e: return this.ADD_i_vx;
                    case 0x29: return this.LD_f_vx;
                    case 0x33: return this.LD_b_vx;
                    case 0x55: return this.LD_pi_vx;
                    case 0x65: return this.LD_vx_pi;
                    default:   return this.NOP;
                }
                default: return this.NOP;
            }
        }).map(func => {
            return func.bind(this)
        });
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
        this.RAM = new Uint8Array(Array.from(this.RAM).concat(
            Array.from(program).concat(Array.from(new Uint8Array(3584 - program.length)))));
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

        let entry: Entry = {
            addr: opcode & 0xfff,
            vx: (opcode >> 8) & 0xf,
            vy: (opcode >> 4) & 0xf,
            byte: opcode & 0xff,
            nibble: opcode & 0xf
        };

        this.opcodes[opcode](entry);
        this.PC += 2;

        this.cbKeyboard();
        this.handleStep = window.setTimeout(() => this.step(), 0);
    }

    reset() {
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60);
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
        cancelAnimationFrame(this.handle60);
    }

    resume() {
        this.refresh60();
        this.step();
    }

    trueStep() {
        this.refresh60();
        this.step();
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60);
    }

    /** Opcodes */
    // ????
    // Unknown opcode, no action, besides wasting one cycle
    protected NOP() {

    }

    // 00E0
    // Clear screen. All pixels are set to black
    protected CLS() {
        this.screen.clear();
    }

    // 00EE
    // Subroutine return
    protected RET() {
        this.PC = this.stack[--this.SP];
    }

    // 0nnn
    // Special routine opcode, usually unused
    protected SYS_addr({addr}: Entry) {

    }

    // 1nnn
    // Set PC to addr
    protected JP_addr({addr}: Entry) {
        this.PC = (addr & 0xfff) - 2;
    }

    // 2nnn
    // Subroutine call
    protected CALL_addr({addr}: Entry) {
        this.stack[this.SP++] = this.PC;
        this.PC = (addr & 0xfff) - 2;
    }

    // 3xkk
    // Skip next instruction if VX = byte
    protected SE_vx_byte({vx, byte}: Entry) {
        if(this.V[vx] === (byte & 0xff)) {
            this.PC += 2;
        }
    }

    // 4xkk
    // Skip next instruction if VX != byte
    protected SNE_vx_byte({vx, byte}: Entry) {
        if(this.V[vx] !== (byte & 0xff)) {
            this.PC += 2;
        }
    }

    // 5xy0
    // Skip next instruction if VX = VY
    protected SE_vx_vy({vx, vy}: Entry) {
        if(this.V[vx] === this.V[vy]) {
            this.PC += 2;
        }
    }

    // 6xkk
    // Set VX = byte
    protected LD_vx_byte({vx, byte}: Entry) {
        this.V[vx] = byte & 0xff;
    }

    // 7xkk
    // Set VX = Vx + byte
    protected ADD_vx_byte({vx, byte}: Entry) {
        this.V[vx] += byte & 0xff;
    }

    // 8xy0
    // Set VX = VY
    protected LD_vx_vy({vx, vy}: Entry) {
        this.V[vx] = this.V[vy];
    }

    // 8xy1
    // Set VX = VX | VY
    protected OR_vx_vy({vx, vy}: Entry) {
        this.V[vx] |= this.V[vy];
    }

    // 8xy2
    // Set VX = VX & VY
    protected AND_vx_vy({vx, vy}: Entry) {
        this.V[vx] &= this.V[vy];
    }

    // 8xy3
    // Set VX = VX ^ VY
    protected XOR_vx_vy({vx, vy}: Entry) {
        this.V[vx] ^= this.V[vy];
    }

    // 8xy4
    // Set VX = VX + VY, VF = carry
    protected ADD_vx_vy({vx, vy}: Entry) {
        this.V[vx] += this.V[vy];
        this.V[0xf] = this.V[vx] < this.V[vy] ? 1 : 0;
    }

    // 8xy5
    // Set VX = VX - VY, VF = NOT borrow
    protected SUB_vx_vy({vx, vy}: Entry) {
        let borrow = this.V[vx] < this.V[vy];
        this.V[vx] -= this.V[vy];
        this.V[0xf] = borrow ? 0 : 1;
    }

    // 8xy6
    // Set VX = VY >> 1, VF = LSB VY
    protected SHR_vx_vy({vx, vy}: Entry) {
        this.V[0xf] = this.V[vy] & 1;
        this.V[vy] >>= 1;
        this.V[vx] = this.V[vy];
    }

    // 8xy7
    // Set VX = VY - VX, VF = NOT borrow
    protected SUBN_vx_vy({vx, vy}: Entry) {
        let borrow = this.V[vy] < this.V[vx];
        this.V[vx] = this.V[vy] - this.V[vx];
        this.V[0xf] = borrow ? 0 : 1;
    }

    // 8xyE
    // Set VX = VY << 1, VF = MSB VY
    protected SHL_vx_vy({vx, vy}: Entry) {
        this.V[0xf] = this.V[vy] >> 7;
        this.V[vy] <<= 1
        this.V[vx] = this.V[vy];
    }

    // 9xy0
    // Skip next instruction if VX != VY
    protected SNE_vx_vy({vx, vy}: Entry) {
        if(this.V[vx] !== this.V[vy]) {
            this.PC += 2;
        }
    }

    // Annn
    // Set I = addr
    protected LD_i_addr({addr}: Entry) {
        this.I = addr;// & 0xfff;
    }

    // Bnnn
    // Set PC = V0 + addr
    protected JP_v0_addr({addr}: Entry) {
        this.PC = this.V[0] + (addr & 0xfff) - 2;
    }

    // Cxkk
    // Set VX = random[0, 255] & byte
    protected RND_vx_byte({vx, byte}: Entry) {
        this.V[vx] = (Math.random() * 255) & (byte & 0xff);
    }

    // Dxyn
    // Draw sprite at RAM[I] to RAM[i+nibble] on screen at (vx, vy)
    // Set VF = collision
    protected DRW_vx_vy_nibble({vx, vy, nibble}: Entry) {
        this.V[0xf] = this.screen.draw(this.V[vx], this.V[vy], new C8_Sprite(this.RAM.slice(this.I, this.I + nibble))) ? 1 : 0;
    }

    // Ex9E
    // Skip next instruction if KEY = VX
    protected SKP_vx({vx}: Entry) {
        if(this.cbKeyboard() === this.V[vx]) {
            this.PC += 2;
        }
    }

    // ExA1
    // Skip next instruction if KEY != VX
    protected SKNP_vx({vx}: Entry) {
        if(this.cbKeyboard() !== this.V[vx]) {
            this.PC += 2;
        }
    }

    // Fx07
    // Set VX = DT
    protected LD_vx_dt({vx}: Entry) {
        this.V[vx] = this.DT;
    }

    // Fx0A
    // Wait for key press, set VX = KEY
    protected LD_vx_k({vx}: Entry) {
        let k = this.cbKeyboard();
        if(k !== undefined) {
            this.V[vx] = k;
        } else {
            this.PC -= 2;
        }
    }

    // Fx15
    // Set DT = VX
    protected LD_dt_vx({vx}: Entry) {
        this.DT = this.V[vx];
    }

    // Fx18
    // Set ST = VX
    protected LD_st_vx({vx}: Entry) {
        this.ST = this.V[vx];
        if(this.ST > 0) {
            this.cbPlaySound();
        }
    }

    // Fx1E
    // Set I = I + VX
    protected ADD_i_vx({vx}: Entry) {
        this.I += this.V[vx];
    }

    // Fx29
    // Set I = sprite(VX)
    protected LD_f_vx({vx}: Entry) {
        this.I = 5 * this.V[vx];
    }

    // Fx33
    // Set RAM[I], RAM[I+1], RAM[I+2] = BCD VX
    protected LD_b_vx({vx}: Entry) {
        this.RAM[this.I] = this.V[vx] / 100;
        this.RAM[this.I+1] = (this.V[vx] / 10) % 10;
        this.RAM[this.I+2] = this.V[vx] % 10;
    }

    // Fx55
    // Set RAM[I], ..., RAM[I+X] = V0, ..., VX
    protected LD_pi_vx({vx}: Entry) {
        for(let i=0; i<=vx; i++, this.I++) {
            this.RAM[this.I] = this.V[i];
        }
    }

    // Fx65
    // Set V0, ..., VX = RAM[I], ..., RAM[I+X]
    protected LD_vx_pi({vx}: Entry) {
        for(let i=0; i<=vx; i++, this.I++) {
            this.V[i] = this.RAM[this.I];
        }
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
        cancelAnimationFrame(this.handle60);
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
