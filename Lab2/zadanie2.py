import pygame
import sys

pygame.init()

WIDTH = 600
HEIGHT = 600

win = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Zadanie 2 - rysunek nr 3")

NIEBIESKI = (0, 0, 255)
BIALY = (255, 255, 255)


def draw_figure(surface):
    surface.fill(BIALY)
    # kwadrat
    pygame.draw.rect(surface, NIEBIESKI, (100, 200, 400, 200))
    # trójkąt górny
    pygame.draw.polygon(surface, NIEBIESKI, [(300, 200), (200, 0), (400, 0)])
    # trójkąt dolny
    pygame.draw.polygon(surface, NIEBIESKI, [(300, 400), (200, 600), (400, 600)])


figure = pygame.Surface((WIDTH, HEIGHT))
draw_figure(figure)

scale = 1.0
angle = 0


def redraw():
    transformed = pygame.transform.rotozoom(figure, angle, scale)
    rect = transformed.get_rect(center=(WIDTH // 2, HEIGHT // 2))
    win.fill(BIALY)
    win.blit(transformed, rect)
    pygame.display.flip()


redraw()

run = True
while run:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            run = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_2:
                scale *= 2
                redraw()
            elif event.key in (pygame.K_UP, pygame.K_DOWN, pygame.K_LEFT, pygame.K_RIGHT):
                angle = (angle + 90) % 360
                redraw()
            elif event.key == pygame.K_0:
                scale = 1.0
                angle = 0
                redraw()

pygame.quit()
sys.exit()
