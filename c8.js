var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
};
var _pixels;
class Surface {
    constructor(width, height, data) {
        _pixels.set(this, void 0);
        __classPrivateFieldSet(this, _pixels, new Uint8Array(width * height));
        this.width = width;
        this.height = height;
        if (data) {
            __classPrivateFieldSet(this, _pixels, Uint8Array.from(Array.from(data).concat(Array.from(__classPrivateFieldGet(this, _pixels).slice(data.length)))));
        }
    }
    clear() {
        __classPrivateFieldSet(this, _pixels, new Uint8Array(this.width * this.height));
    }
    getPixels() {
        return __classPrivateFieldGet(this, _pixels);
    }
    getPixel(x, y) {
        return __classPrivateFieldGet(this, _pixels)[(y % this.height) * this.width + (x % this.width)];
    }
    xorPixel(x, y, val) {
        __classPrivateFieldGet(this, _pixels)[(y % this.height) * this.width + (x % this.width)] ^= val;
        return (__classPrivateFieldGet(this, _pixels)[(y % this.height) * this.width + (x % this.width)] === 0 && val !== 0);
    }
    draw(x, y, sprite) {
        let collision = false;
        for (let j = 0; j < sprite.height; j++) {
            for (let i = 0; i < sprite.width; i++) {
                if (__classPrivateFieldGet(this, _pixels)[((y + j) % this.height) * this.width + ((x + i) % this.width)] > 0 && sprite.getPixel(i, j) > 0) {
                    collision = true;
                }
                __classPrivateFieldGet(this, _pixels)[((y + j) % this.height) * this.width + ((x + i) % this.width)] ^= sprite.getPixel(i, j);
            }
        }
        return collision;
    }
    scroll(x, y) {
        x = (x + this.width) % this.width;
        y = (y + this.height) / this.height;
        let newPixels = new Uint8Array(__classPrivateFieldGet(this, _pixels).length);
        for (let j = 0; j < this.height; j++) {
            for (let i = 0; j < this.width; i++) {
                newPixels[((y + j) % this.height) * this.width + ((x + i) % this.width)] = __classPrivateFieldGet(this, _pixels)[j * this.width + i];
            }
        }
        __classPrivateFieldSet(this, _pixels, newPixels);
    }
    toString() {
        let out = "";
        for (let i = 0; i < this.height; i++) {
            out += __classPrivateFieldGet(this, _pixels).slice(i * this.width, (i + 1) * this.width).reduce((acc, val) => acc + val.toString(), "") + "\n";
        }
        return out;
    }
    toImageData() {
        let id = new ImageData(this.width, this.height);
        for (let i = 0; i < id.data.length; i += 4) {
            id.data[i] = __classPrivateFieldGet(this, _pixels)[i / 4] * 255;
            id.data[i + 1] = __classPrivateFieldGet(this, _pixels)[i / 4] * 255;
            id.data[i + 2] = __classPrivateFieldGet(this, _pixels)[i / 4] * 255;
            id.data[i + 3] = 255;
        }
        return id;
    }
}
_pixels = new WeakMap();
class C8_Screen extends Surface {
    constructor() {
        super(64, 32);
    }
}
class C8_Sprite extends Surface {
    constructor(data) {
        if (data.length < 1 || data.length > 15) {
            throw new RangeError("Chip8 sprites can be up to 15 pixels high");
        }
        let expandedData = new Array();
        data.forEach(val => {
            expandedData = expandedData.concat([val >> 7, (val >> 6) & 1, (val >> 5) & 1, (val >> 4) & 1,
                (val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1]);
        });
        super(8, data.length, expandedData);
    }
}
class SC8_Sprite extends Surface {
    constructor(data) {
        if (data.length !== 32) {
            throw new RangeError("SChip8 sprites can only be 16x16 pixels");
        }
        let expandedData = new Array();
        for (let i = 0; i < 16; i++) {
            let [b1, b2] = [data[i], data[i + 1]];
            expandedData = expandedData.concat([b1 >> 7, (b1 >> 6) & 1, (b1 >> 5) & 1, (b1 >> 4) & 1,
                (b1 >> 3) & 1, (b1 >> 2) & 1, (b1 >> 1) & 1, b1 & 1,
                b2 >> 7, (b2 >> 6) & 1, (b2 >> 5) & 1, (b2 >> 4) & 1,
                (b2 >> 3) & 1, (b2 >> 2) & 1, (b2 >> 1) & 1, b2 & 1]);
        }
        super(16, 16, expandedData);
    }
}
class C8_CPU {
    constructor(cbRefresh60, cbKeyboard, cbPlaySound, cbStopSound, program) {
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
            switch (opcode >> 12) {
                case 0: return (opcode % 256) === 0xe0 ? this.CLS :
                    (opcode % 256) === 0xee ? this.RET : this.SYS_addr;
                case 1: return this.JP_addr;
                case 2: return this.CALL_addr;
                case 3: return this.SE_vx_byte;
                case 4: return this.SNE_vx_byte;
                case 5: return (opcode % 16) === 0 ? this.SE_vx_vy : this.NOP;
                case 6: return this.LD_vx_byte;
                case 7: return this.ADD_vx_byte;
                case 8: switch (opcode % 16) {
                    case 0: return this.LD_vx_vy;
                    case 1: return this.OR_vx_vy;
                    case 2: return this.AND_vx_vy;
                    case 3: return this.XOR_vx_vy;
                    case 4: return this.ADD_vx_vy;
                    case 5: return this.SUB_vx_vy;
                    case 6: return this.SHR_vx_vy;
                    case 7: return this.SUBN_vx_vy;
                    case 0xe: return this.SHL_vx_vy;
                    default: return this.NOP;
                }
                case 9: return (opcode % 16) === 0 ? this.SNE_vx_vy : this.NOP;
                case 0xa: return this.LD_i_addr;
                case 0xb: return this.JP_v0_addr;
                case 0xc: return this.RND_vx_byte;
                case 0xd: return this.DRW_vx_vy_nibble;
                case 0xe: return (opcode % 256) === 0x9e ? this.SKP_vx :
                    (opcode % 256) === 0xa1 ? this.SKNP_vx : this.NOP;
                case 0xf: switch (opcode % 256) {
                    case 0x7: return this.LD_vx_dt;
                    case 0xa: return this.LD_vx_k;
                    case 0x15: return this.LD_dt_vx;
                    case 0x18: return this.LD_st_vx;
                    case 0x1e: return this.ADD_i_vx;
                    case 0x29: return this.LD_f_vx;
                    case 0x33: return this.LD_b_vx;
                    case 0x55: return this.LD_pi_vx;
                    case 0x65: return this.LD_vx_pi;
                    default: return this.NOP;
                }
                default: return this.NOP;
            }
        }).map(func => {
            return func.bind(this);
        });
    }
    load(program) {
        if (typeof program === "string") {
            program = program.replace(/[^0-9A-Fa-f]/g, "");
            let tmp = [];
            for (let i = 0; i < program.length; i += 2) {
                tmp.push(parseInt(program[i] + program[i + 1], 16));
            }
            program = tmp;
        }
        this.RAM = new Uint8Array(Array.from(this.RAM).concat(Array.from(program).concat(Array.from(new Uint8Array(3584 - program.length)))));
    }
    /** Accessors for byte and word values */
    get I() {
        return this._I[0];
    }
    set I(val) {
        this._I[0] = val;
    }
    get DT() {
        return this._DT[0];
    }
    set DT(val) {
        this._DT[0] = val;
    }
    get ST() {
        return this._ST[0];
    }
    set ST(val) {
        this._ST[0] = val;
    }
    get PC() {
        return this._PC[0];
    }
    set PC(val) {
        this._PC[0] = val;
    }
    get SP() {
        return this._SP[0];
    }
    set SP(val) {
        this._SP[0] = val;
    }
    getV(i) {
        return this.V[i];
    }
    getStack(i) {
        return this.stack[i];
    }
    getI() {
        return this.I;
    }
    getDT() {
        return this.DT;
    }
    getST() {
        return this.ST;
    }
    getPC() {
        return this.PC;
    }
    getSP() {
        return this.SP;
    }
    getRAMSprite() {
        return new C8_Sprite(this.RAM.slice(this.I, this.I + 15));
    }
    getOP() {
        return this.RAM[this.PC] * 256 + this.RAM[this.PC + 1];
    }
    /** loop functions */
    refresh60() {
        if (this.DT > 0) {
            this.DT--;
        }
        if (this.ST > 0) {
            this.ST--;
        }
        if (this.ST === 0) {
            this.cbStopSound();
        }
        this.cbRefresh60();
        this.handle60 = requestAnimationFrame(() => this.refresh60());
    }
    step() {
        let opcode = this.RAM[this.PC] * 0x100 + this.RAM[this.PC + 1];
        if (opcode === 0) {
            return;
        }
        let entry = {
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
    NOP() {
    }
    // 00E0
    // Clear screen. All pixels are set to black
    CLS() {
        this.screen.clear();
    }
    // 00EE
    // Subroutine return
    RET() {
        this.PC = this.stack[--this.SP];
    }
    // 0nnn
    // Special routine opcode, usually unused
    SYS_addr({ addr }) {
    }
    // 1nnn
    // Set PC to addr
    JP_addr({ addr }) {
        this.PC = (addr & 0xfff) - 2;
    }
    // 2nnn
    // Subroutine call
    CALL_addr({ addr }) {
        this.stack[this.SP++] = this.PC;
        this.PC = (addr & 0xfff) - 2;
    }
    // 3xkk
    // Skip next instruction if VX = byte
    SE_vx_byte({ vx, byte }) {
        if (this.V[vx] === (byte & 0xff)) {
            this.PC += 2;
        }
    }
    // 4xkk
    // Skip next instruction if VX != byte
    SNE_vx_byte({ vx, byte }) {
        if (this.V[vx] !== (byte & 0xff)) {
            this.PC += 2;
        }
    }
    // 5xy0
    // Skip next instruction if VX = VY
    SE_vx_vy({ vx, vy }) {
        if (this.V[vx] === this.V[vy]) {
            this.PC += 2;
        }
    }
    // 6xkk
    // Set VX = byte
    LD_vx_byte({ vx, byte }) {
        this.V[vx] = byte & 0xff;
    }
    // 7xkk
    // Set VX = Vx + byte
    ADD_vx_byte({ vx, byte }) {
        this.V[vx] += byte & 0xff;
    }
    // 8xy0
    // Set VX = VY
    LD_vx_vy({ vx, vy }) {
        this.V[vx] = this.V[vy];
    }
    // 8xy1
    // Set VX = VX | VY
    OR_vx_vy({ vx, vy }) {
        this.V[vx] |= this.V[vy];
    }
    // 8xy2
    // Set VX = VX & VY
    AND_vx_vy({ vx, vy }) {
        this.V[vx] &= this.V[vy];
    }
    // 8xy3
    // Set VX = VX ^ VY
    XOR_vx_vy({ vx, vy }) {
        this.V[vx] ^= this.V[vy];
    }
    // 8xy4
    // Set VX = VX + VY, VF = carry
    ADD_vx_vy({ vx, vy }) {
        this.V[vx] += this.V[vy];
        this.V[0xf] = this.V[vx] < this.V[vy] ? 1 : 0;
    }
    // 8xy5
    // Set VX = VX - VY, VF = NOT borrow
    SUB_vx_vy({ vx, vy }) {
        let borrow = this.V[vx] < this.V[vy];
        this.V[vx] -= this.V[vy];
        this.V[0xf] = borrow ? 0 : 1;
    }
    // 8xy6
    // Set VX = VY >> 1, VF = LSB VY
    SHR_vx_vy({ vx, vy }) {
        this.V[0xf] = this.V[vy] & 1;
        this.V[vy] >>= 1;
        this.V[vx] = this.V[vy];
    }
    // 8xy7
    // Set VX = VY - VX, VF = NOT borrow
    SUBN_vx_vy({ vx, vy }) {
        let borrow = this.V[vy] < this.V[vx];
        this.V[vx] = this.V[vy] - this.V[vx];
        this.V[0xf] = borrow ? 0 : 1;
    }
    // 8xyE
    // Set VX = VY << 1, VF = MSB VY
    SHL_vx_vy({ vx, vy }) {
        this.V[0xf] = this.V[vy] >> 7;
        this.V[vy] <<= 1;
        this.V[vx] = this.V[vy];
    }
    // 9xy0
    // Skip next instruction if VX != VY
    SNE_vx_vy({ vx, vy }) {
        if (this.V[vx] !== this.V[vy]) {
            this.PC += 2;
        }
    }
    // Annn
    // Set I = addr
    LD_i_addr({ addr }) {
        this.I = addr; // & 0xfff;
    }
    // Bnnn
    // Set PC = V0 + addr
    JP_v0_addr({ addr }) {
        this.PC = this.V[0] + (addr & 0xfff) - 2;
    }
    // Cxkk
    // Set VX = random[0, 255] & byte
    RND_vx_byte({ vx, byte }) {
        this.V[vx] = (Math.random() * 255) & (byte & 0xff);
    }
    // Dxyn
    // Draw sprite at RAM[I] to RAM[i+nibble] on screen at (vx, vy)
    // Set VF = collision
    DRW_vx_vy_nibble({ vx, vy, nibble }) {
        this.V[0xf] = this.screen.draw(this.V[vx], this.V[vy], new C8_Sprite(this.RAM.slice(this.I, this.I + nibble))) ? 1 : 0;
    }
    // Ex9E
    // Skip next instruction if KEY = VX
    SKP_vx({ vx }) {
        if (this.cbKeyboard() === this.V[vx]) {
            this.PC += 2;
        }
    }
    // ExA1
    // Skip next instruction if KEY != VX
    SKNP_vx({ vx }) {
        if (this.cbKeyboard() !== this.V[vx]) {
            this.PC += 2;
        }
    }
    // Fx07
    // Set VX = DT
    LD_vx_dt({ vx }) {
        this.V[vx] = this.DT;
    }
    // Fx0A
    // Wait for key press, set VX = KEY
    LD_vx_k({ vx }) {
        let k = this.cbKeyboard();
        if (k !== undefined) {
            this.V[vx] = k;
        }
        else {
            this.PC -= 2;
        }
    }
    // Fx15
    // Set DT = VX
    LD_dt_vx({ vx }) {
        this.DT = this.V[vx];
    }
    // Fx18
    // Set ST = VX
    LD_st_vx({ vx }) {
        this.ST = this.V[vx];
        if (this.ST > 0) {
            this.cbPlaySound();
        }
    }
    // Fx1E
    // Set I = I + VX
    ADD_i_vx({ vx }) {
        this.I += this.V[vx];
    }
    // Fx29
    // Set I = sprite(VX)
    LD_f_vx({ vx }) {
        this.I = 5 * this.V[vx];
    }
    // Fx33
    // Set RAM[I], RAM[I+1], RAM[I+2] = BCD VX
    LD_b_vx({ vx }) {
        this.RAM[this.I] = this.V[vx] / 100;
        this.RAM[this.I + 1] = (this.V[vx] / 10) % 10;
        this.RAM[this.I + 2] = this.V[vx] % 10;
    }
    // Fx55
    // Set RAM[I], ..., RAM[I+X] = V0, ..., VX
    LD_pi_vx({ vx }) {
        for (let i = 0; i <= vx; i++, this.I++) {
            this.RAM[this.I] = this.V[i];
        }
    }
    // Fx65
    // Set V0, ..., VX = RAM[I], ..., RAM[I+X]
    LD_vx_pi({ vx }) {
        for (let i = 0; i <= vx; i++, this.I++) {
            this.V[i] = this.RAM[this.I];
        }
    }
}
class SC8_CPU extends C8_CPU {
    constructor(cbRefresh60, cbKeyboard, cbPlaySound, cbStopSound, program) {
        super(cbRefresh60, cbKeyboard, cbPlaySound, cbStopSound, program);
        this.R = new Uint8Array(8);
    }
    // 00Bn
    // Scroll display n pixels up
    SCU_nibble({ nibble }) {
        this.screen.scroll(0, -nibble);
    }
    // 00Cn
    // Scroll display n pixels down
    SCD_nibble({ nibble }) {
        this.screen.scroll(0, nibble);
    }
    // 00FB
    // Scroll display 4 pixels right
    SCR() {
        this.screen.scroll(4, 0);
    }
    // 00FC
    // Scroll display 4 pixels left
    SCL() {
        this.screen.scroll(-4, 0);
    }
    // 00FD
    // Exit the interpreter
    EXIT() {
        this.screen.clear();
        clearTimeout(this.handleStep);
        cancelAnimationFrame(this.handle60);
    }
    // 00FE
    // Enable low-res (64x32) mode
    LOW() {
    }
    // 00FF
    // Enable high-res (128x64) mode
    HIGH() {
    }
    // Dxyn
    // Draw sprite at RAM[I] to RAM[i+nibble] on screen at (vx, vy)
    // When n = 0 and high-res mode is enabled, draw high-res 16x16 sprite
    // Set VF = collision
    DRW_vx_vy_nibble({ vx, vy, nibble }) {
        let sprite = (nibble === 0) ?
            new SC8_Sprite(this.RAM.slice(this.I, this.I + 32)) :
            new C8_Sprite(this.RAM.slice(this.I, this.I + nibble));
        this.V[0xf] = this.screen.draw(this.V[vx], this.V[vy], sprite) ? 1 : 0;
    }
    // FX30
    // Set I = high-res sprite(VX)
    LD_HF_Vx({ vx }) {
        this.I = 80 + 20 * this.V[vx];
    }
    // Fx75
    // Set R flags to values of V0, ...,  VX (X <= 7)
    LD_R_VX({ vx }) {
        for (let i = 0; i <= vx; i++) {
            this.R[i] = this.V[i];
        }
    }
    // Fx85
    // Set registers V0, ..., VX to values of R flags (X <= 7)
    LD_VX_R({ vx }) {
        for (let i = 0; i <= vx; i++) {
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
