# Trabalho 2 de PAA

## Anotações

Sigma deve ser aproximadamente 1/3 do Raio do Kernel O raio R é dado por R = (size - 1)/2. O valor 5 para um kernel 15x15 gera um blur mais forte e pesos mais espalhados.

#### Tamanho do Kernel (Size),Raio (R),Sigma (σ) Ideal (Regra ≈R/3),Efeito na Imagem

3,1,"≈0,33", Leve / Suavização
9,4,"≈1,3", Moderado
15,7,"≈2,3", Forte
21,10,"≈3,3", Muito Forte

#### Impacto no Trabalho (Métricas)

Aumentar o kernel aumenta drasticamente o número de cálculos.

Kernel 5x5 = 25 multiplicações por pixel.

Kernel 21x21 = 441 multiplicações por pixel.
