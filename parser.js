function testNNN(val) {
    return parseInt(val) >= 0 && parseInt(val) < 0x1000;
}
function testKK(val) {
    return parseInt(val) >= 0 && parseInt(val) < 0x100;
}
function testN(val) {
    return parseInt(val) >= 0 && parseInt(val) < 0x10;
}
function testV(val) {
    return val.toString().match(/V[0-9A-F]/) !== null;
}
function tabNNN(q1, val) {
    return [0x10 * q1 + (parseInt(val) >> 8), parseInt(val) & 0xff];
}
function tabXKK(q1, vx, kk) {
    return [0x10 * q1 + parseInt(vx[1], 16), parseInt(kk)];
}
function tabXY(q1, vx, vy, q4) {
    return [0x10 * q1 + parseInt(vx[1], 16), 0x10 * parseInt(vy[1], 16) + q4];
}

const mapOperationAsserts = new Map();
mapOperationAsserts.set("CLS", {
    func: ligne => ligne.length === 1,
    format: "CLS",
    opcode: () => [0, 0xe0]
});
mapOperationAsserts.set("RET", {
    func: ligne => ligne.length === 1,
    format: "RET",
    opcode: () => [0, 0xee]
});
mapOperationAsserts.set("SYS", {
    func: ligne => ligne.length === 2 && testNNN(ligne[1]),
    format: "SYS nnn",
    opcode: ligne => tabNNN(0, ligne[1])
});
mapOperationAsserts.set("JP", {
    func: ligne => {
        if(ligne.length === 2) {
            return testNNN(ligne[1]);
        } else if(ligne.length === 3) {
            return ligne[1] === "V0" && testNNN(ligne[2]);
        }
        return false;
    },
    format: "JP [V0] nnn",
    opcode: ligne => ligne.length === 2 ? tabNNN(1, ligne[1]) : tabNNN(0xb, ligne[2])
});
mapOperationAsserts.set("CALL", {
    func: ligne => ligne.length === 2 && testNNN(ligne[1]),
    format: "CALL nnn",
    opcode: ligne => tabNNN(2, ligne[1])
});
mapOperationAsserts.set("SE", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && (testV(ligne[2]) || testKK(ligne[2])),
    format: "SE Vx (Vy | kk)",
    opcode: ligne => testV(ligne[2]) ? tabXY(5, ligne[1], ligne[2], 0) : tabXKK(3, ligne[1], ligne[2])
});
mapOperationAsserts.set("SNE", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && (testV(ligne[2]) || testKK(ligne[2])),
    format: "SNE Vx (Vy | kk)",
    opcode: ligne => testV(ligne[2]) ? tabXY(9, ligne[1], ligne[2], 0) : tabXKK(4, ligne[1], ligne[2])
});
mapOperationAsserts.set("LD", {
    func: ligne => {
        if(ligne.length !== 3) {
            return false;
        }
        if(testV(ligne[1])) {
            return testKK(ligne[2]) || testV(ligne[2]) || ["DT", "K", "[I]"].indexOf(ligne[2]) !== -1;
        }
        if(testV(ligne[2])) {
            return ["DT", "ST", "F", "B", "[I]"].indexOf(ligne[1]) !== -1;
        }
        return ligne[1] === "I" && testNNN(ligne[2]);
    },
    format: "LD Vx (Vy | kk | DT | K | [I]), LD (DT | ST | F | B | [I]) Vx",
    opcode: ligne => {
        if(testV(ligne[1])) {
            if(testV(ligne[2])) {
                return tabXY(8, ligne[1], ligne[2], 0);
            }
            switch(ligne[2]) {
                case "DT": return tabXKK(0xf, ligne[1], 7);
                case "K": return tabXKK(0xf, ligne[1], 0xa);
                case "[I]": return tabXKK(0xf, ligne[1], 0x65);
                default: return tabXKK(6, ligne[1], ligne[2]);
            }
        }
        switch(ligne[1]) {
            case "I": return tabNNN(0xa, ligne[2]);
            case "DT": return tabXKK(0xf, ligne[2], 0x15);
            case "ST": return tabXKK(0xf, ligne[2], 0x18);
            case "F": return tabXKK(0xf, ligne[2], 0x29);
            case "B": return tabXKK(0xf, ligne[2], 0x33);
            case "[I]": return tabXKK(0xf, ligne[2], 0x55);
        }
    }
});
mapOperationAsserts.set("ADD", {
    func: ligne => {
        if(ligne.length !== 3) {
            return false;
        }
        if(testV(ligne[1])) {
            return testV(ligne[2]) || testKK(ligne[2]);
        } else if(ligne[1] === "I") {
            return testV(ligne[2]);
        }
        return false;
    },
    format: "ADD Vx (Vy | kk), LD I Vx",
    opcode: ligne => ligne[1] === "I" ? tabXKK(0xf, ligne[2], 0x1e) : testV(ligne[2]) ? tabXY(8, ligne[1], ligne[2], 4) : tabXKK(7, ligne[1], ligne[2])
});
mapOperationAsserts.set("OR", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "OR Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 1)
});
mapOperationAsserts.set("AND", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "AND Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 2)
});
mapOperationAsserts.set("XOR", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "XOR Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 3)
});
mapOperationAsserts.set("SUB", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "SUB Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 5)
});
mapOperationAsserts.set("SHR", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "SHR Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 6)
});
mapOperationAsserts.set("SUBN", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "SUBN Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 7)
});
mapOperationAsserts.set("SHL", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testV(ligne[2]),
    format: "SHL Vx Vy",
    opcode: ligne => tabXY(8, ligne[1], ligne[2], 0xe)
});
mapOperationAsserts.set("RND", {
    func: ligne => ligne.length === 3 && testV(ligne[1]) && testKK(ligne[2]),
    format: "RND Vx kk",
    opcode: ligne => tabXKK(0xc, ligne[1], ligne[2])
});
mapOperationAsserts.set("DRW", {
    func: ligne => ligne.length === 4 && testV(ligne[1]) && testV(ligne[2]) && testN(ligne[3]),
    format: "DRW Vx Vy n",
    opcode: ligne => tabXY(0xd, ligne[1], ligne[2], ligne[3])
});
mapOperationAsserts.set("SKP", {
    func: ligne => ligne.length === 2 && testV(ligne[1]),
    format: "SKP Vx",
    opcode: ligne => tabXKK(0xe, ligne[1], 0x9e)
});
mapOperationAsserts.set("SKNP", {
    func: ligne => ligne.length === 2 && testV(ligne[1]),
    format: "SKNP Vx",
    opcode: ligne => tabXKK(0xe, ligne[1], 0xa1)
});

// 1 instruction par ligne
// lignes commençant par ";" => commentaires
// tokens spéciaux: ":", "@", "$", "#"
// : / @ => labels de saut
// $ => label de constante
// # => littéral, ne doit pas être parsé
// ## => littéral (filler)
// exemple:
// ; boucle où on assigne une valeur constante à V1
// $const 42
// jp @loop
// loop:
//     ld v1 $const
//     jp @loop

function parse(prg) {
    // Suppression des commentaires et des lignes vides
    // Séparation des termes
    let lignes = prg.split(/[\r\n\|]/).filter(ligne => !(ligne.trim().startsWith(";") || ligne === ""))
        .map(ligne => ligne.trim().toUpperCase().replace(/[^A-Z0-9\:\$\@\s\#\[\]]/g, "").split(/\s/).filter(ligne => ligne !== ""));
    lignes = lignes.map(ligne => ligne.map(e => e.toUpperCase())).filter(ligne => ligne.length > 0);
    
    // Récupération des constantes
    let constantTokens = new Map();
    lignes.filter(ligne => ligne[0].startsWith("$")).forEach(ligne => {
        if(ligne.length !== 2 || isNaN(ligne[1])) {
            throw new Error(`Bad format for constant '${ligne}', expected '$const 123' or '$const 0x12'`);
        }
        if(constantTokens.has(ligne[0])) {
            console.warn(`Redefinition of constant '${ligne}'`);
        }
        constantTokens.set(ligne[0], parseInt(ligne[1]));
    });
    lignes = lignes.filter(ligne => !ligne[0].startsWith("$")).map(ligne => ligne.map(e => {
        if(e.startsWith("$")) {
            if(!constantTokens.has(e)) {
                throw new Error(`Unknown constant on line '${ligne}`);
            }
            return constantTokens.get(e);
        }
        return e;
    }));

    // Calcul des longueurs des lignes
    lignes = lignes.map(ligne => {
        if(ligne[0].endsWith(":")) {
            if(ligne.length > 1) {
                throw new Error(`Bad format for label '${ligne}', expected 'label:'`);
            }
            return {
                data: ligne,
                type: "label",
                length: 0
            };
        } else if(ligne[0].startsWith("##")) {
            if(ligne.length > 2) {
                throw new Error(`Bad format for filler litteral '${ligne}, expected '##1a 345'`);
            }
            let byte = parseInt(ligne[0].replace("##",""), 16) % 256;
            let length = parseInt(ligne[1]);
            ligne = [new Array(length).fill(byte).reduce((acc, val) => acc + val.toString(16).padStart(2, "0"), "#")];
        }
        if(ligne[0].startsWith("#")) {
            if(ligne.length > 1) {
                throw new Error(`Bad format for litteral '${ligne}', expected '#123456789abcdef'`);
            }
            let length = parseInt(ligne[0].length / 2);
            ligne[0] = ligne[0].replace("#", ligne[0].length % 2 === 0  ? "0": "");
            return {
                data: ligne,
                type: "litteral",
                length: length
            };
        }
        return {
            data: ligne,
            type: "operation",
            length: 2
        };
    });

    // Récupération des labels de sauts
    let labelTokens = new Map();
    for(let i=0, pc=0x200; i<lignes.length; i++) {
        let ligne = lignes[i];
        if(ligne.type === "label") {
            if(labelTokens.has("@" + ligne.data[0].replace(":", ""))) {
                console.warn(`Redefinition of label '${ligne.data[0]}'`);
            }
            labelTokens.set("@" + ligne.data[0].replace(":", ""), pc);
        }
        pc += ligne.length;
    }
    lignes = lignes.filter(ligne => ligne.type !== "label").map(ligne => {
        return {
            type: ligne.type,
            length: ligne.length,
            data: ligne.data.map(e => {
                if(e.toString().startsWith("@")) {
                    if(!labelTokens.has(e)) {
                        throw new Error(`Unknown label on line '${ligne.data.join(" ")}`);
                    }
                    return labelTokens.get(e);
                }
                if(!isNaN(e) && ligne.type !== "litteral") {
                    return parseInt(e);
                }
                return e;
            })
        };
    });

    let prgout = new Uint8Array(lignes.reduce((acc, ligne) => acc + ligne.length, 0));
    let cursor = 0;
    lignes.forEach(ligne => {
        if(ligne.type === "litteral") {
            prgout.set(ligne.data[0].match(/.{2}/g).map(e => parseInt(e, 16)), cursor);
        } else {
            if(!mapOperationAsserts.has(ligne.data[0])) {
                throw new Error(`Unknown operation on line '${ligne.data.join(" ")}'`);
            }
            let op = mapOperationAsserts.get(ligne.data[0]);
            if(!op.func(ligne.data)) {
                throw new Error(`Bad format on line '${ligne.data.join(" ")}', expected '${op.format}'`);
            }
            [prgout[cursor], prgout[cursor+1]] = op.opcode(ligne.data);
        }
        cursor += ligne.length;
    });

    // TEMP
    let output = prgout.reduce((acc, val) => acc + val.toString(16).padStart(2, "0"), "");
    if(prgout.length > 3584) {
        console.warn(`Chip-8 programs usually have a max size of 3584 bytes, current program has ${prgout.length}`);
    }
    return {lignes, prgout, output, constantTokens, labelTokens};
}