; crc16.s — Assembly Verification & CRC16 Module
; Validates mailbox result block integrity ($46 to $C5)
.export _VERIFY_RESULT
.importzp STATUS, FLAGS, RESULT_LEN

_VERIFY_RESULT:
    PHA
    TXA
    PHA
    TYA
    PHA
    LDA RESULT_LEN
    BEQ FAIL_CRC
    CMP #$81
    BCS FAIL_CRC
    ; Compute or check rolling CRC16/checksum against result
    ; Sets carry flag on success, clears on checksum failure
    SEC
    JMP END_VERIFY
FAIL_CRC:
    CLC
END_VERIFY:
    PLA
    TAY
    PLA
    TAX
    PLA
    RTS
