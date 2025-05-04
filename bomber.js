/**
TODO:

FIXED:
BUG E01: Winning at stage 99 switches to stages 100 and onward, but on screen it's level "00".
RESULT: Game may continue, but is unwinnable at level 136: the number of floors to destroy
        becomes higher than the number of floors that can be drawn.
SOLUTION: Winning level 99 results in a Game Over (end game).

BUG E02: Sometimes the number of floors to destroy is higher than the number of floors displayed.
RESULT: The stage is unwinnable.
SOLUTION: In routine "zLevelDraw" prevent floor counter from decreasing when number of floors
          on a building exceeds the max height (6)

BUG B01: Bomb can collide with the plane when it goes down.
RESULT: Loses a life, glitched sprite remaining that can collide with the plane.
SOLUTION: Disabled launching the bomb at the (2, Y) coordinates.

BUG B02: The bomb collides on its inflight position when the plane collides with a building
RESULT: Glitched sprite remaining that can collide with plane
SOLUTION: X coordinate of the bomb was being overwritten (register V4).
          Used at the time the unused register VB instead.
*/
var bomberPrg = `
;Bomber Game (BLITZ clone)
;Simon Brangier 2023

$nbLifeStart 3
$nbStartLevel 1

jp @start

;sprites
sprTitle:
;stars + bomb
    #00000004000080
    #02032103030301
    #40c088c0c0c080
    #00000040000002
;big title
    #ff007f003f001f000f
    #fe09e90ee909ee00ff
    #324b4a4a4a4a3200ff
    #2764a4a724242718ff
    #3da1a139a1a13d00ff
    #ff202fc02f202f00ff
    #ff00fe00fc00f800f0
;big star
    #fc7848
;crosshair
    #d682
    #82d6
;text
    #ccaacc8a8a
    #e688c482ec
    #60854125c1
    #8351c15141
    #9028282810
    #6e844424c4
    #4caaecaaaa
    #e040404040

sprGameOver:
    #73848487b49474
    #22b6aaaaa2a2a2
    #f08080e08080f0
    #64949494929261
    #5e50505c90901e
    #e09090e0909090

sprGround:
    #ff
sprLimit:
    #800080008000800080008000
sprLevel:
    #8e888c88ee
    #aea8aca84e
    #80808080e0
sprCleared:
    #688888886e
    #e48ace8aea
    #cea8cca8ae
    #c8a8a8a0c8
sprLoading:
    #848a8a8ae4
    #4caaeaaaac
    #a435ada5a4
    #c0006020d5
sprLife:
    #80c0e0c080
sprLifePlus:
    #80c2e7c280
sprFloor:
    #e0a0e0

sprPlane:
    #98fe0c04
sprBomb:
    #8080
sprExplosion:
    #8040a0a06060

;buffers
bfNbLife:
    #00
bfTemp:
    #00000000000000000000000000000000
bfInit:
    #00000000000000000000000000000000

zSetNbLife:
    ld i @bfNbLife
    ld v0 vc
    ld [i] v0
    ret

zGetNbLife:
    ld i @bfNbLife
    ld v0 [i]
    ld vc v0
    ret

fDrawIntro1:
    drw v0 v1 9 | add v0 8 | add i v2
    ret

fDrawIntro2:
    drw v0 v1 5 | add v0 8 | add i v2
    ret

zDrawTitle:
    cls
    ld v0 16 | ld v1 1 | ld v2 7 | ld i @sprTitle
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add i v2
    ld v0 4 | ld v1 9 | ld v2 9
    call @fDrawIntro1
    call @fDrawIntro1
    call @fDrawIntro1
    call @fDrawIntro1
    call @fDrawIntro1
    call @fDrawIntro1
    drw v0 v1 9 | add i v2
    ld v0 29 | ld v1 18 | ld v2 3
    drw v0 v1 3 | add i v2
    ret

zDrawIntro:
    call @zDrawTitle
    ld v0 24 | ld v1 22 | ld v2 2
    drw v0 v1 2 | ld v1 29 | add i v2
    drw v0 v1 2 | add i v2
    ld v0 3 | ld v1 24 | ld v2 5
    call @fDrawIntro2
    call @fDrawIntro2
    call @fDrawIntro2
    call @fDrawIntro2
    call @fDrawIntro2
    call @fDrawIntro2
    call @fDrawIntro2
    drw v0 v1 5
    lpWaitA:
        ld v0 k
        se v0 10
            jp @lpWaitA
    ret

fDrawHUD1:
    drw v0 v1 1 | add v0 8
    ret

zDrawHUD:
    cls
    ld v0 0 | ld v1 24 | ld i @sprGround
    call @fDrawHUD1
    call @fDrawHUD1
    call @fDrawHUD1
    call @fDrawHUD1
    call @fDrawHUD1
    call @fDrawHUD1
    call @fDrawHUD1
    drw v0 v1 1
    call @zGetNbLife
    ld v0 1 | ld v1 26 | ld v2 0 | ld i @sprLife
    lpDrawHUDLife:
        drw v0 v1 5
        add v0 3 | add v2 1
        se v2 vc
            jp @lpDrawHUDLife
    ld v8 v0 | add v8 253
    ld v0 32 | ld v2 5 | ld i @sprLevel
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5
    ld i @bfTemp | ld b ve | ld v2 [i]
    ld f v1 | ld v0 54 | ld v1 26
    drw v0 v1 5
    ld f v2 | add v0 5
    drw v0 v1 5
    ret

zGetNbFloors:
    ld vd ve | shr vd vd | add vd 5
    ret

zLevelDraw:
    ld v0 16 | ld v1 9 | ld v2 5 | ld i @sprLoading
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5
    call @zGetNbFloors
    ld i @bfInit | ld vb [i]
    lpFloorInc:
        rnd vc 1 | add v0 vc
        sne v0 7
            ld vc 0
        sne v0 7
            add v0 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v1 vc
        sne v1 7
            ld vc 0
        sne v1 7
            add v1 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v2 vc
        sne v2 7
            ld vc 0
        sne v2 7
            add v2 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v3 vc
        sne v3 7
            ld vc 0
        sne v3 7
            add v3 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v4 vc
        sne v4 7
            ld vc 0
        sne v4 7
            add v4 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v5 vc
        sne v5 7
            ld vc 0
        sne v5 7
            add v5 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v6 vc
        sne v6 7
            ld vc 0
        sne v6 7
            add v6 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v7 vc
        sne v7 7
            ld vc 0
        sne v7 7
            add v7 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v8 vc
        sne v8 7
            ld vc 0
        sne v8 7
            add v8 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add v9 vc
        sne v9 7
            ld vc 0
        sne v9 7
            add v9 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add va vc
        sne va 7
            ld vc 0
        sne va 7
            add va 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        rnd vc 1 | add vb vc
        sne vb 7
            ld vc 0
        sne vb 7
            add vb 255
        sub vd vc
        sne vd 0
            jp @inInitDrawFloor0
        jp @lpFloorInc
    inInitDrawFloor0:
        ld i @bfTemp | ld [i] v2
        ld v0 16 | ld v1 9 | ld v2 5 | ld i @sprLoading
        drw v0 v1 5 | add v0 8 | add i v2
        drw v0 v1 5 | add v0 8 | add i v2
        drw v0 v1 5 | add v0 8 | add i v2
        drw v0 v1 5
        ld i @bfTemp | ld v2 [i]
        ld vc 12 | ld vd 21 | ld i @sprFloor
        lpDrawFloor0:
            sne v0 0
                jp @inInitDrawFloor1
            drw vc vd 3 | add v0 255 | add vd 253
            jp @lpDrawFloor0
    inInitDrawFloor1:
        add vc 4 | ld vd 21
        lpDrawFloor1:
            sne v1 0
                jp @inInitDrawFloor2
            drw vc vd 3 | add v1 255 | add vd 253
            jp @lpDrawFloor1
    inInitDrawFloor2:
        add vc 4 | ld vd 21
        lpDrawFloor2:
            sne v2 0
                jp @inInitDrawFloor3
            drw vc vd 3 | add v2 255 | add vd 253
            jp @lpDrawFloor2
    inInitDrawFloor3:
        add vc 4 | ld vd 21
        lpDrawFloor3:
            sne v3 0
                jp @inInitDrawFloor4
            drw vc vd 3 | add v3 255 | add vd 253
            jp @lpDrawFloor3
    inInitDrawFloor4:
        add vc 4 | ld vd 21
        lpDrawFloor4:
            sne v4 0
                jp @inInitDrawFloor5
            drw vc vd 3 | add v4 255 | add vd 253
            jp @lpDrawFloor4
    inInitDrawFloor5:
        add vc 4 | ld vd 21
        lpDrawFloor5:
            sne v5 0
                jp @inInitDrawFloor6
            drw vc vd 3 | add v5 255 | add vd 253
            jp @lpDrawFloor5
    inInitDrawFloor6:
        add vc 4 | ld vd 21
        lpDrawFloor6:
            sne v6 0
                jp @inInitDrawFloor7
            drw vc vd 3 | add v6 255 | add vd 253
            jp @lpDrawFloor6
    inInitDrawFloor7:
        add vc 4 | ld vd 21
        lpDrawFloor7:
            sne v7 0
                jp @inInitDrawFloor8
            drw vc vd 3 | add v7 255 | add vd 253
            jp @lpDrawFloor7
    inInitDrawFloor8:
        add vc 4 | ld vd 21
        lpDrawFloor8:
            sne v8 0
                jp @inInitDrawFloor9
            drw vc vd 3 | add v8 255 | add vd 253
            jp @lpDrawFloor8
    inInitDrawFloor9:
        add vc 4 | ld vd 21
        lpDrawFloor9:
            sne v9 0
                jp @inInitDrawFloorA
            drw vc vd 3 | add v9 255 | add vd 253
            jp @lpDrawFloor9
    inInitDrawFloorA:
        add vc 4 | ld vd 21
        lpDrawFloorA:
            sne va 0
                jp @inInitDrawFloorB
            drw vc vd 3 | add va 255 | add vd 253
            jp @lpDrawFloorA
    inInitDrawFloorB:
        add vc 4 | ld vd 21
        lpDrawFloorB:
            sne vb 0
                ret
            drw vc vd 3 | add vb 255 | add vd 253
            jp @lpDrawFloorB

zDrawLevelCleared:
    ld v0 22 | ld v1 2 | ld v2 5 | ld i @sprLevel
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | ld v0 17 | ld v1 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5 | add v0 8 | add i v2
    drw v0 v1 5
    ret

zClearLevel:
    cls
    add ve 1
    sne ve 100
        jp @zGameOver
    call @zDrawHUD
    call @zDrawLevelCleared
    sne ve 10
        jp @inLifePlus
    sne ve 25
        jp @inLifePlus
    sne ve 50
        jp @inLifePlus
    jp @inClearWait
    inLifePlus:
        call @zGetNbLife
        add vc 1
        call @zSetNbLife
        ld v1 1
        lpIncX:
            add v1 3
            add v0 255
            se v0 1
                jp @lpIncX
        ld v0 v1
        ld v1 26
        ld i @sprLife
        drw v0 v1 5
        ld v0 26 | ld v1 16 | ld v2 5 | add i v2
        drw v0 v1 5 | add v0 8 | ld v2 1 | ld f v2
        drw v0 v1 5
    inClearWait:
        ld v0 120 | ld dt v0
        lpClearWait:
            ld v0 dt
            se v0 0
                jp @lpClearWait
    cls
    call @zGetNbLife
    call @zStartLevel
    ret

zDescentPlane:
    ld i @sprPlane
    drw v2 v3 4 | ld v2 0 | add v3 2
    drw v2 v3 4
    ret

zIncPlane:
    ld i @sprPlane
    drw v2 v3 4 | add v2 1
    drw v2 v3 4
    sne v2 64
        call @zDescentPlane
    se vf 1
        ret
    ld v0 v2
    ld v1 v3
    add v0 3
    add v1 252
    call @zExplode
    add vc 255
    sne vc 0
        call @zGameOver
    call @zSetNbLife
    ld i @sprLife
    ld v0 1
    ld v1 26
    ld vb 0
    lpLifeIncX:
        add v0 3
        add vb 1
        se vb vc
            jp @lpLifeIncX
    drw v0 v1 5
    ld i @sprPlane
    drw v2 v3 4
    ld v2 1
    ld v3 1
    drw v2 v3 4
    ret

zLaunchBomb:
    sne v6 1
        ret
    ld vf 2
    ld st vf
    ld v4 v2 | ld v5 v3
    add v4 3 | add v5 2
    shr v4 v4 | shl v4 v4
    ld vf 63 | and v4 vf
    sne v4 2
        ret
    ld v6 1 | ld i @sprBomb
    drw v4 v5 2
    ret

zDescendBomb:
    ld i @sprBomb
    drw v4 v5 2
    add v5 1
    drw v4 v5 2
    se vf 1
        ret
    drw v4 v5 2
    ld v6 0 | ld v0 v4 | ld v1 v5
    add v0 255 | add v1 252
    call @zExplode
    se v5 23
        call @zdestroyFloor
    ret

zExplode:
    ld i @sprExplosion
    ld vf 60 | ld dt vf
    lpExplosionLoop:
        ld vf 2
        ld st vf
        drw v0 v1 6 | drw v0 v1 6
        ld vf dt
        se vf 0
            jp @lpExplosionLoop
        ret

zDestroyFloor:
    ld i @sprFloor
    add v0 245
    shr v0 v0 | shr v0 v0
    shl v0 v0 | shl v0 v0
    add v0 12 | add v1 5
    drw v0 v1 3
    add vd 255
    se vd 0
        ret
    call @zClearLevel
    ret

zGameOver:
    cls
    ld vf 5
    ld st vf
    ld v0 16 | ld v1 1 | ld v2 7 | ld i @sprTitle
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add i v2
    ld vf 5
    ld st vf
    ld v0 4 | ld v1 9 | ld v2 9
    drw v0 v1 9 | add v0 8 | add i v2
    drw v0 v1 9 | add v0 8 | add i v2
    drw v0 v1 9 | add v0 8 | add i v2
    drw v0 v1 9 | add v0 8 | add i v2
    drw v0 v1 9 | add v0 8 | add i v2
    drw v0 v1 9 | add v0 8 | add i v2
    drw v0 v1 9 | add i v2
    ld vf 50
    ld st vf
    ld v0 29 | ld v1 18 | ld v2 3
    drw v0 v1 3
    ld v0 9 | ld v1 23 | ld v2 7 | ld i @sprGameOver
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | ld v0 35 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7 | add v0 8 | add i v2
    drw v0 v1 7
    #0000

zStartLevel:
    call @zDrawHUD
    call @zLevelDraw
    ld vf 20
    ld st vf
    call @zGetNbFloors
    call @zGetNbLife
    ld v2 1
    ld v3 1
    ld v9 10
    ld i @sprPlane
    drw v2 v3 4
    ret

start:
    call @zDrawIntro
    ld v0 $nbLifeStart
    ld i @bfNbLife
    ld [i] v0
    ld ve $nbStartLevel
    call @zStartLevel
    lpGameLoop:
        call @zIncPlane
        sknp v9
            call @zLaunchBomb
        sne v6 1
            call @zDescendBomb
        
        jp @lpGameLoop
`;
